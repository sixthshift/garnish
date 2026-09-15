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
  // The file, not the rows, so an edited migration re-applies; the WAL sidecars too, or the next open sees "file is not a database". Backups stay.
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
