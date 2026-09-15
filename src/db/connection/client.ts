import type { Database } from "bun:sqlite";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";

export type Db = ReturnType<typeof wrap>;

function wrap(db: Database) {
  // No schema: the relational query API is unused, every repository joins explicitly.
  return drizzle(db);
}

/**
 * Either handle a query can run on: the database, or the transaction handle
 * Drizzle hands a `transaction` callback. Repositories that share a helper
 * between transactional and plain paths take this.
 */
export type Executor = BunSQLiteDatabase | Parameters<Parameters<BunSQLiteDatabase["transaction"]>[0]>[0];

// One wrapper per underlying connection. Repositories are constructed per
// request, and rebuilding the wrapper each time would rebuild Drizzle's own
// state with them; the connection is the natural key and it outlives them all.
const wrappers = new WeakMap<Database, Db>();

/** The Drizzle handle for `db`, created once per connection. */
export function orm(db: Database): Db {
  const existing = wrappers.get(db);
  if (existing) return existing;
  const created = wrap(db);
  wrappers.set(db, created);
  return created;
}
