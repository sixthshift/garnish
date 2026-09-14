// Server-only. Runs once when the server entry loads; never import from client code.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_DATA_DIR = "./data";

/** Resolve the runtime volume from `DATA_DIR`, defaulting to `./data`. */
export function dataDir(env: Record<string, string | undefined> = process.env): string {
  const dir = env.DATA_DIR?.trim();
  return resolve(dir && dir.length > 0 ? dir : DEFAULT_DATA_DIR);
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
