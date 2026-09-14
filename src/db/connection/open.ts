// Server-only. Opening the SQLite file: where it lives and the pragmas every
// connection needs. Never import from client code.
//
// Separate from the migration runner so that opening a database does not drag
// migrations in: `backup/` and `seed/cli.ts` want a handle, not a schema
// upgrade.
import { Database } from "bun:sqlite";
import { join } from "node:path";
import { dataDir } from "../../server/core/boot";

export const DB_FILE = "garnish.db";

/** Path of the SQLite file inside the runtime volume. */
export function databasePath(dir: string = dataDir()): string {
  return join(dir, DB_FILE);
}

/** Open (creating if needed) a database with WAL journaling and foreign keys on. */
export function openDatabase(path: string): Database {
  const db = new Database(path, { create: true, strict: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}
