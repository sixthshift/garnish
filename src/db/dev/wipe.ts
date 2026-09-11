// Dev-only. Emptying DATA_DIR so the next migrate builds the database from
// nothing.
//
// Deleting the file rather than the rows is deliberate: it takes the schema
// with it, so a migration edited in place is re-applied rather than skipped
// because its `migration` row is already there. That is the usual reason to
// want a clean slate mid-development.
//
// The WAL sidecars go too — leaving them beside a deleted database is how you
// get a "file is not a database" on the next open. The generated images go
// because nothing would reference them afterwards. Backups are left alone:
// wiping is about the working database, not the copies taken of it.
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DB_FILE } from "../connection/open";

export type WipeResult = {
  /** Paths that existed and were removed, relative to the directory. */
  removed: string[];
};

/**
 * Delete the database, its sidecars and the images directory under `dir`.
 * Missing paths are skipped, so this is safe to run against a fresh clone.
 */
export function wipeDataDir(dir: string): WipeResult {
  const targets = [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`, "images"];
  const removed: string[] = [];
  for (const target of targets) {
    const path = join(dir, target);
    if (!existsSync(path)) continue;
    rmSync(path, { recursive: true, force: true });
    removed.push(target);
  }
  return { removed };
}
