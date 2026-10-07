// `bun run restore <file.zip>`: replace the household's data with a backup
// (decisions.md row 131). Never merges. The database as it was is kept first as
// DATA_DIR/backups/garnish-pre-restore-….db.
import { databasePath, openDatabase } from "../../db/connection/open";
import { migrate } from "../../db/migrations/migrate";
import { backupRepository } from "../../db/models/backup/repo";
import { seed } from "../../db/seed/seed";
import { ensureDataDir } from "../core/boot";
import { describeCounts } from "./counts";
import { restoreBackup } from "./restore";

/** The one argument: the backup's path. Pure. */
export function parseRestoreArgs(argv: readonly string[]): string {
  if (argv.length !== 1 || argv[0]!.startsWith("-")) throw new Error("Usage: bun run restore <garnish-backup-….zip>");
  return argv[0]!;
}

if (import.meta.main) {
  let file: string;
  try {
    file = parseRestoreArgs(process.argv.slice(2));
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
  const source = Bun.file(file);
  if (!(await source.exists())) {
    console.error(`${file}: no such file`);
    process.exit(1);
  }

  const dir = ensureDataDir();
  const db = openDatabase(databasePath(dir));
  try {
    // Migrated and seeded as the server would be, so the seed's batches are
    // recorded and a later start does not lay its starter rows over the restore.
    await migrate(db);
    seed(db);
    const result = await restoreBackup(backupRepository(db), dir, new Uint8Array(await source.arrayBuffer()));
    if (!result.ok) {
      console.error(`${file}: not restored, nothing was changed`);
      for (const problem of result.problems) console.error(`  ${problem}`);
      process.exitCode = 1;
    } else {
      console.log(`${databasePath(dir)}: restored from the backup of ${result.createdAt}`);
      console.log(describeCounts(result.counts));
      console.log(`the database as it was is kept at ${result.snapshot}`);
    }
  } finally {
    db.close();
  }
}
