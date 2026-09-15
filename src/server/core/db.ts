// The one process-wide SQLite handle: opened from DATA_DIR on first use, migrated and seeded once, then cached.

import type { Database } from "bun:sqlite";
import { basename } from "node:path";
import { databasePath, openDatabase } from "../../db/connection/open";
import { type MigrationSources, migrate } from "../../db/migrations/migrate";
import { seed } from "../../db/seed/seed";
import { dataDir, ensureDataDir } from "./boot";

/**
 * Migration SQL by file name, as bundled into this module. Exported for tests.
 *
 * Vite inlines the SQL at build time (dev, vitest and the Nitro bundle all go
 * through it), so the built server needs no migrations directory on disk. The
 * glob sits inside the function rather than at module level because every
 * repository imports this module for its default export, and the `seed` and
 * `dev:seed` CLIs import repositories under plain Bun, where `import.meta.glob`
 * does not exist; there it is simply never called. The `bun run migrate` CLI
 * reads src/db/migrations directly.
 */
export function bundledMigrations(): MigrationSources {
  const bundledSql = import.meta.glob<string>("../../db/migrations/*.sql", { query: "?raw", eager: true, import: "default" });
  return Object.fromEntries(Object.entries(bundledSql).map(([path, sql]) => [basename(path), sql]));
}

let handle: Database | undefined;

function open(): Database {
  const db = openDatabase(databasePath(ensureDataDir(dataDir())));
  try {
    migrate(db, { sources: bundledMigrations() });
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
 * cached, so the next call retries. Synchronous: `bun:sqlite` is, and the
 * migrations are bundled, so nothing here waits on IO.
 */
export function getDb(): Database {
  if (!handle) handle = open();
  return handle;
}

/** Close and forget the cached handle. Tests call this between temp directories. */
export function closeDb(): void {
  const closing = handle;
  handle = undefined;
  closing?.close();
}
