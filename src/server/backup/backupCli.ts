// `bun run backup`: the whole household as a zip in DATA_DIR/backups
// (decisions.md row 131). `bun run restore <zip>` puts one back.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { backupsDir } from "../../db/backup/snapshot";
import { databasePath, openDatabase } from "../../db/connection/open";
import { migrate } from "../../db/migrations/migrate";
import { backupRepository } from "../../db/models/backup/repo";
import { backupFileName } from "../../domain/backup";
import { ensureDataDir } from "../core/boot";
import { describeCounts } from "./counts";
import { takeBackup } from "./take";

if (import.meta.main) {
  if (process.argv.length > 2) {
    console.error(`Unknown argument ${process.argv[2]}. Usage: bun run backup`);
    process.exit(1);
  }
  const dir = ensureDataDir();
  const db = openDatabase(databasePath(dir));
  try {
    await migrate(db);
    const taken = await takeBackup(backupRepository(db), dir);
    const out = backupsDir(dir);
    mkdirSync(out, { recursive: true });
    const path = join(out, backupFileName(taken.createdAt));
    if (await Bun.file(path).exists()) throw new Error(`${path} already exists`);
    await Bun.write(path, taken.bytes);
    console.log(`${databasePath(dir)}: backed up to ${path}`);
    console.log(describeCounts(taken.counts));
    for (const missing of taken.missingImages) console.warn(`missing on disk, left out: ${missing}`);
  } finally {
    db.close();
  }
}
