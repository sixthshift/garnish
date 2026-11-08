import type { Database } from "bun:sqlite";
import { openDatabase } from "../../src/db/connection/open";
import { migrate } from "../../src/db/migrations/migrate";

/** A fresh in-memory database with every migration applied: what a repository test starts from. */
export function migratedDb(): Database {
  const db = openDatabase(":memory:");
  migrate(db);
  return db;
}
