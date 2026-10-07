import type { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../../server/core/boot";

export const BACKUPS_SUBDIR = "backups";

/** Directory that receives backups, and restore's snapshots, inside the runtime volume. */
export function backupsDir(dir: string = dataDir()): string {
  return join(dir, BACKUPS_SUBDIR);
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** `garnish-pre-restore-YYYYMMDD-HHmmss.db` in UTC; digits and dashes only, so it is safe on every filesystem. */
export function snapshotFileName(now: Date = new Date()): string {
  const date = `${pad(now.getUTCFullYear(), 4)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
  const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `garnish-pre-restore-${date}-${time}.db`;
}

/**
 * The database as it stood before a restore replaced it (decisions.md row 131):
 * a safety net to put back by hand, not a backup the household chooses — that
 * is the zip (`src/server/backup/`).
 *
 * Write a compacted copy of `db` into `dir` (created if missing) and return the
 * new file's path. Uses `VACUUM INTO`, so the copy is a consistent snapshot even
 * while the source is in WAL mode with other connections open. Throws if the
 * target file already exists, which is what two snapshots within one second do.
 */
export function snapshot(db: Database, dir: string, now: Date = new Date()): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, snapshotFileName(now));
  db.prepare("VACUUM INTO ?").run(path);
  return path;
}
