// The guard that makes the per-domain schema.ts files trustworthy.
//
// `migrations/*.sql` builds the database; the domain `schema.ts` files are the mirror
// the repositories compile against. Nothing in Drizzle checks that the two
// agree — declare a column the migrations never added and the query builder
// will happily emit SQL for it, failing at runtime. So this test migrates a
// real database and compares it against the declared schema, column by column.
//
// A new migration therefore fails here until the schema is updated to match,
// which is the point (decisions.md row 46).
import type { Database } from "bun:sqlite";
import { is } from "drizzle-orm";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import { beforeAll, expect, test } from "vitest";
import { openDatabase } from "../../src/db/connection/open";
import { migrate } from "../../src/db/migrations/migrate";

type ColumnInfo = { name: string; type: string; notnull: 0 | 1; pk: number };

let db: Database;
beforeAll(async () => {
  db = openDatabase(":memory:");
  await migrate(db);
});

// Every table every domain declares. A glob rather than a list of imports, so a
// domain added without being wired in here still gets checked.
const modules = import.meta.glob<Record<string, unknown>>("../../src/db/models/**/schema.ts", { eager: true });
const declared = Object.values(modules)
  .flatMap((module) => Object.values(module))
  .filter((value): value is SQLiteTable => is(value, SQLiteTable));

/** The declared tables by their SQL name. */
const declaredByName = new Map(declared.map((t) => [getTableConfig(t).name, t]));

function columns(table: string): ColumnInfo[] {
  return db.query<ColumnInfo, []>(`PRAGMA table_info(${table})`).all();
}

test("declares every table the migrations create, and no others", () => {
  const actual = db
    .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((r) => r.name)
    .sort();
  expect([...declaredByName.keys()].sort()).toEqual(actual);
});

test.each([...declaredByName.keys()].sort())("%s columns match the migrated table", (name) => {
  const table = declaredByName.get(name)!;
  const config = getTableConfig(table);
  const actual = columns(name);

  // Same columns, same order as the CREATE TABLE.
  expect(config.columns.map((c) => c.name)).toEqual(actual.map((c) => c.name));

  const actualByName = new Map(actual.map((c) => [c.name, c]));
  for (const column of config.columns) {
    const real = actualByName.get(column.name)!;
    // SQLite reports the declared type; Drizzle knows the same three affinities.
    expect(real.type.toLowerCase(), `${name}.${column.name} type`).toBe(column.getSQLType());
    // SQLite does not imply NOT NULL on a TEXT PRIMARY KEY (only INTEGER
    // PRIMARY KEY, the rowid alias, is exempt from allowing NULL), while
    // Drizzle models every primary key as not-null. That difference is the
    // engine's, not drift, so primary keys are compared as keys below.
    if (real.pk === 0) expect(real.notnull === 1, `${name}.${column.name} NOT NULL`).toBe(column.notNull);
  }

  // Primary key, single or composite, as a set of column names.
  const declaredPk = new Set([
    ...config.columns.filter((c) => c.primary).map((c) => c.name),
    ...config.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name)),
  ]);
  const actualPk = new Set(actual.filter((c) => c.pk > 0).map((c) => c.name));
  expect(declaredPk, `${name} primary key`).toEqual(actualPk);
});
