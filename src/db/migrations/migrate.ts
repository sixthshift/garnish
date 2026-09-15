import type { Database } from "bun:sqlite";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDataDir } from "../../server/core/boot";
import { databasePath, openDatabase } from "../connection/open";

// This file's own directory: the runner lives beside the SQL it runs.
// import.meta.url rather than Bun's import.meta.dir: Vite's module runner (vitest) only supplies the former.
export const MIGRATIONS_DIR = dirname(fileURLToPath(import.meta.url));

export type Migration = { id: number; name: string; file: string };

const FILENAME = /^(\d{3,})_([a-z0-9_]+)\.sql$/;

/** Parse `NNN_snake_name.sql` into its parts, or null when the name doesn't fit. */
export function parseMigrationFile(file: string): Migration | null {
  const m = FILENAME.exec(file);
  if (!m) return null;
  return { id: Number(m[1]), name: m[2]!, file };
}

/** The migrations among `files`, sorted by id; other names are ignored. Throws on duplicate ids. */
export function listMigrationsFrom(files: Iterable<string>): Migration[] {
  const found = Array.from(files)
    .map(parseMigrationFile)
    .filter((m): m is Migration => m !== null)
    .sort((a, b) => a.id - b.id);
  for (let i = 1; i < found.length; i++) {
    if (found[i]!.id === found[i - 1]!.id) {
      throw new Error(`Duplicate migration id ${found[i]!.id}: ${found[i - 1]!.file}, ${found[i]!.file}`);
    }
  }
  return found;
}

/** All migration files in `dir`, sorted by id. Throws on duplicate ids. */
export function listMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  return listMigrationsFrom(readdirSync(dir));
}

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS migration (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)`;

/** Names of migrations already recorded in `db`, by id. */
export function appliedMigrations(db: Database): Map<number, string> {
  db.exec(CREATE_TABLE);
  const rows = db.query<{ id: number; name: string }, []>("SELECT id, name FROM migration ORDER BY id").all();
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** Migration SQL keyed by file name (`NNN_name.sql`), for callers that bundle the files. */
export type MigrationSources = Record<string, string>;

export type MigrateOptions = {
  /** Directory to read `*.sql` from. Default: the source tree's `migrations/`. Ignored when `sources` is given. */
  migrationsDir?: string;
  /** Already-loaded SQL by file name; the bundled server passes this because it has no directory to read. */
  sources?: MigrationSources;
};

/**
 * Apply every pending migration in id order. Each file runs in its own
 * transaction together with its `migration` row, so a failing file leaves
 * nothing behind. Returns the migrations applied on this run.
 */
export async function migrate(db: Database, opts: MigrateOptions = {}): Promise<Migration[]> {
  const dir = opts.migrationsDir ?? MIGRATIONS_DIR;
  const where = opts.sources ? "the bundled migrations" : dir;
  const all = opts.sources ? listMigrationsFrom(Object.keys(opts.sources)) : listMigrations(dir);
  const applied = appliedMigrations(db);

  for (const [id, name] of applied) {
    const onDisk = all.find((m) => m.id === id);
    if (!onDisk) throw new Error(`Migration ${id} (${name}) is recorded but missing from ${where}`);
    if (onDisk.name !== name) {
      throw new Error(`Migration ${id} is recorded as "${name}" but the file is "${onDisk.name}"`);
    }
  }

  const pending = all.filter((m) => !applied.has(m.id));
  const { sources: bundled } = opts;
  const sources = bundled ? pending.map((m) => bundled[m.file]!) : await Promise.all(pending.map((m) => Bun.file(join(dir, m.file)).text()));

  const insert = db.prepare("INSERT INTO migration (id, name) VALUES (?, ?)");
  const apply = db.transaction((m: Migration, sql: string) => {
    db.exec(sql);
    insert.run(m.id, m.name);
  });

  pending.forEach((m, i) => apply(m, sources[i]!));
  return pending;
}

if (import.meta.main) {
  const dir = ensureDataDir();
  const path = databasePath(dir);
  const db = openDatabase(path);
  try {
    const done = await migrate(db);
    console.log(done.length === 0 ? `${path}: up to date` : `${path}: applied ${done.map((m) => m.file).join(", ")}`);
  } finally {
    db.close();
  }
}
