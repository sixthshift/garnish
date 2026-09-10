// Server-only. Copies the live database into a fresh, compacted file with
// `VACUUM INTO`. The source is only read: WAL mode, page contents and open
// connections are all left as they were. Never import from client code.
import type { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir, ensureDataDir } from "../server/boot";
import { databasePath, openDatabase } from "./migrate";

export const BACKUPS_SUBDIR = "backups";

/** Directory that receives backups inside the runtime volume. */
export function backupsDir(dir: string = dataDir()): string {
  return join(dir, BACKUPS_SUBDIR);
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** `garnish-YYYYMMDD-HHmmss.db` in UTC; digits and dashes only, so it is safe on every filesystem. */
export function backupFileName(now: Date = new Date()): string {
  const date = `${pad(now.getUTCFullYear(), 4)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
  const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `garnish-${date}-${time}.db`;
}

/**
 * Write a compacted copy of `db` into `dir` (created if missing) and return the
 * new file's path. Uses `VACUUM INTO`, so the copy is a consistent snapshot even
 * while the source is in WAL mode with other connections open. Throws if the
 * target file already exists, which is what two backups within one second do.
 */
export function backup(db: Database, dir: string, now: Date = new Date()): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, backupFileName(now));
  db.prepare("VACUUM INTO ?").run(path);
  return path;
}

if (import.meta.main) {
  const dir = ensureDataDir();
  const db = openDatabase(databasePath(dir));
  try {
    const path = backup(db, backupsDir(dir));
    console.log(`${databasePath(dir)}: backed up to ${path}`);
  } finally {
    db.close();
  }
}
