// Server-only. The one process-wide SQLite handle: opened from DATA_DIR on
// first use, migrated and seeded once, then cached. Never import from client code.
import type { Database } from "bun:sqlite";
import { basename } from "node:path";
import { databasePath, openDatabase } from "../../db/connection/open";
import { migrate, type MigrationSources } from "../../db/migrations/migrate";
import { seed } from "../../db/seed/seed";
import { dataDir, ensureDataDir } from "./boot";

// Vite inlines the SQL at build time (dev, vitest and the Nitro bundle all go
// through it), so the built server needs no migrations directory on disk. The
// `bun run migrate` CLI still reads src/db/migrations directly.
const bundledSql = import.meta.glob<string>("../../db/migrations/*.sql", { query: "?raw", eager: true, import: "default" });

/** Migration SQL by file name, as bundled into this module. Exported for tests. */
export function bundledMigrations(): MigrationSources {
  return Object.fromEntries(Object.entries(bundledSql).map(([path, sql]) => [basename(path), sql]));
}

let handle: Promise<Database> | undefined;

async function open(): Promise<Database> {
  const db = openDatabase(databasePath(ensureDataDir(dataDir())));
  try {
    await migrate(db, { sources: bundledMigrations() });
    seed(db);
  } catch (error) {
    db.close();
    throw error;
  }
  return db;
}

/**
 * The application database. The first call opens `DATA_DIR/garnish.db`
 * (creating the directory and file), applies pending migrations and seeds
 * reference data; later calls return the same handle. A failed open is not
 * cached, so the next call retries.
 */
export function getDb(): Promise<Database> {
  if (!handle) {
    const opening = open();
    handle = opening;
    opening.catch(() => {
      if (handle === opening) handle = undefined;
    });
  }
  return handle;
}

/** Close and forget the cached handle. Tests call this between temp directories. */
export async function closeDb(): Promise<void> {
  const closing = handle;
  handle = undefined;
  if (!closing) return;
  const db = await closing.catch(() => undefined);
  db?.close();
}
