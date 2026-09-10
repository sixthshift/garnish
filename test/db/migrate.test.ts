import { Database } from "bun:sqlite";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import {
  DB_FILE,
  MIGRATIONS_DIR,
  appliedMigrations,
  databasePath,
  listMigrations,
  listMigrationsFrom,
  migrate,
  openDatabase,
  parseMigrationFile,
} from "../../src/db/migrate";

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tmp(prefix = "garnish-migrate-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

function migrationsDir(files: Record<string, string>): string {
  const dir = tmp();
  for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql);
  return dir;
}

const TWO = {
  "001_recipe.sql": "CREATE TABLE recipe (id TEXT PRIMARY KEY, name TEXT NOT NULL);",
  "002_tag.sql":
    "CREATE TABLE tag (id TEXT PRIMARY KEY, name TEXT NOT NULL);\n" +
    "CREATE TABLE recipe_tag (recipe_id TEXT REFERENCES recipe(id) ON DELETE CASCADE, tag_id TEXT REFERENCES tag(id));",
};

function tables(db: Database): string[] {
  return db
    .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((r) => r.name);
}

test("parseMigrationFile accepts NNN_name.sql and rejects everything else", () => {
  expect(parseMigrationFile("001_init.sql")).toEqual({ id: 1, name: "init", file: "001_init.sql" });
  expect(parseMigrationFile("0042_add_aisle_2.sql")).toEqual({ id: 42, name: "add_aisle_2", file: "0042_add_aisle_2.sql" });
  expect(parseMigrationFile("01_short.sql")).toBeNull();
  expect(parseMigrationFile("001-init.sql")).toBeNull();
  expect(parseMigrationFile("001_Init.sql")).toBeNull();
  expect(parseMigrationFile("001_init.txt")).toBeNull();
  expect(parseMigrationFile(".gitkeep")).toBeNull();
  expect(parseMigrationFile("README.md")).toBeNull();
});

test("listMigrations sorts by id and ignores other files", () => {
  const dir = migrationsDir({
    "010_c.sql": "",
    "002_b.sql": "",
    "notes.md": "",
    "001_a.sql": "",
  });
  expect(listMigrations(dir).map((m) => m.file)).toEqual(["001_a.sql", "002_b.sql", "010_c.sql"]);
});

test("listMigrations throws on duplicate ids", () => {
  const dir = migrationsDir({ "001_a.sql": "", "001_b.sql": "" });
  expect(() => listMigrations(dir)).toThrow(/Duplicate migration id 1/);
});

test("migrate applies in order on :memory:, second run is a no-op", async () => {
  const dir = migrationsDir(TWO);
  const db = openDatabase(":memory:");

  const first = await migrate(db, { migrationsDir: dir });
  expect(first.map((m) => m.file)).toEqual(["001_recipe.sql", "002_tag.sql"]);
  expect(tables(db)).toEqual(["migration", "recipe", "recipe_tag", "tag"]);
  expect([...appliedMigrations(db)]).toEqual([
    [1, "recipe"],
    [2, "tag"],
  ]);

  const second = await migrate(db, { migrationsDir: dir });
  expect(second).toEqual([]);
  expect(tables(db)).toEqual(["migration", "recipe", "recipe_tag", "tag"]);
  expect(db.query<{ n: number }, []>("SELECT count(*) AS n FROM migration").get()?.n).toBe(2);
});

test("migrate applies only migrations newer than those recorded", async () => {
  const dir = migrationsDir({ "001_recipe.sql": TWO["001_recipe.sql"] });
  const db = openDatabase(":memory:");
  await migrate(db, { migrationsDir: dir });

  writeFileSync(join(dir, "002_tag.sql"), TWO["002_tag.sql"]);
  const applied = await migrate(db, { migrationsDir: dir });
  expect(applied.map((m) => m.id)).toEqual([2]);
  expect(tables(db)).toContain("tag");
});

test("a failing migration rolls back and records nothing", async () => {
  const dir = migrationsDir({
    "001_recipe.sql": TWO["001_recipe.sql"],
    "002_bad.sql": "CREATE TABLE tag (id TEXT PRIMARY KEY);\nTHIS IS NOT SQL;",
  });
  const db = openDatabase(":memory:");

  await expect(migrate(db, { migrationsDir: dir })).rejects.toThrow();
  expect(tables(db)).toEqual(["migration", "recipe"]);
  expect([...appliedMigrations(db).keys()]).toEqual([1]);
});

test("migrate refuses a database recorded ahead of, or differently from, the files", async () => {
  const dir = migrationsDir(TWO);
  const db = openDatabase(":memory:");
  await migrate(db, { migrationsDir: dir });

  rmSync(join(dir, "002_tag.sql"));
  await expect(migrate(db, { migrationsDir: dir })).rejects.toThrow(/recorded but missing/);

  writeFileSync(join(dir, "002_label.sql"), TWO["002_tag.sql"]);
  await expect(migrate(db, { migrationsDir: dir })).rejects.toThrow(/recorded as "tag"/);
});

test("openDatabase creates the file with WAL and foreign keys on", () => {
  const dir = tmp();
  const path = databasePath(dir);
  expect(path).toBe(join(dir, DB_FILE));
  expect(existsSync(path)).toBe(false);

  const db = openDatabase(path);
  expect(existsSync(path)).toBe(true);
  expect(db.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get()?.journal_mode).toBe("wal");
  expect(db.query<{ foreign_keys: number }, []>("PRAGMA foreign_keys").get()?.foreign_keys).toBe(1);
  db.close();
});

test("foreign keys are enforced on an opened database", async () => {
  const db = openDatabase(":memory:");
  await migrate(db, { migrationsDir: migrationsDir(TWO) });
  expect(() => db.run("INSERT INTO recipe_tag (recipe_id, tag_id) VALUES ('nope', 'nope')")).toThrow(/FOREIGN KEY/);
});

test("the default migrations directory resolves and applies cleanly twice", async () => {
  expect(existsSync(MIGRATIONS_DIR)).toBe(true);
  const db = openDatabase(":memory:");
  const first = await migrate(db);
  const second = await migrate(db);
  expect(second).toEqual([]);
  expect(appliedMigrations(db).size).toBe(first.length);
});

test("listMigrationsFrom works on names alone, ignoring non-migrations", () => {
  const found = listMigrationsFrom(["002_tag.sql", "notes.txt", "001_recipe.sql", "README.md"]);
  expect(found.map((m) => m.file)).toEqual(["001_recipe.sql", "002_tag.sql"]);
  expect(() => listMigrationsFrom(["001_a.sql", "001_b.sql"])).toThrow(/Duplicate migration id 1/);
});

test("migrate accepts bundled sources instead of a directory", async () => {
  const db = openDatabase(":memory:");
  const first = await migrate(db, { sources: TWO });
  expect(first.map((m) => m.file)).toEqual(["001_recipe.sql", "002_tag.sql"]);
  expect(tables(db)).toEqual(["migration", "recipe", "recipe_tag", "tag"]);
  expect(await migrate(db, { sources: TWO })).toEqual([]);

  const { "002_tag.sql": _dropped, ...onlyOne } = TWO;
  await expect(migrate(db, { sources: onlyOne })).rejects.toThrow(/missing from the bundled migrations/);
});
