import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

export const DEFAULT_DATA_DIR = "./data";

/** Resolve the runtime volume from `DATA_DIR`, defaulting to `./data`. */
export function dataDir(env: Record<string, string | undefined> = process.env): string {
  const dir = env.DATA_DIR?.trim();
  return resolve(dir && dir.length > 0 ? dir : DEFAULT_DATA_DIR);
}

/** Where backups, and the copies a restore keeps of what it replaced, are written: `<DATA_DIR>/backups`. */
export function backupsDir(root: string = dataDir()): string {
  return join(root, "backups");
}

/** Create the runtime volume if it is missing. Idempotent. Returns the absolute path. */
export function ensureDataDir(dir: string = dataDir()): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Everything that must happen before the first request. */
export function boot(): { dataDir: string } {
  return { dataDir: ensureDataDir() };
}
