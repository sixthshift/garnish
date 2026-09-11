// Shared column vocabulary, and the conventions every model in this folder
// follows.
//
// `migrations/*.sql` is what actually builds the database. These schema files
// are the mirror the repositories compile against, not a second migration
// source: `test/db/drift.test.ts` migrates a real database and asserts the two
// agree on tables, column names and order, types, nullability and primary keys,
// so drift fails a test rather than surfacing as a runtime surprise
// (decisions.md row 46).
//
// The mirror also carries foreign keys with their ON DELETE, indexes and CHECK
// constraints, for `bun run db:generate`'s benefit. What it cannot carry is
// `COLLATE NOCASE` on the `name` columns of aisle, unit, food and tag — Drizzle
// has no collation builder — so generated SQL is a starting point to edit, never
// a file to apply as-is. The collation still applies to every query the builder
// emits, because SQLite resolves it from the column: `eq(food.name, x)` matches
// case-insensitively exactly as the hand-written `WHERE name = ?` did.
//
// Conventions follow 001_init.sql: UUID text ids, ISO 8601 UTC text timestamps,
// integer 0/1 booleans — declared `{ mode: "boolean" }` so the 0/1 stays in
// SQLite and the repositories see real booleans — recipe-owned rows cascading
// and reference lookups setting null.
import { sql } from "drizzle-orm";

/** `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`, the default every timestamp column carries. */
export const nowUtc = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
