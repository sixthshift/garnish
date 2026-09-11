import { Database } from "bun:sqlite";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { BACKUPS_SUBDIR, backup, backupFileName, backupsDir } from "../../../src/db/backup/backup";
import { openDatabase } from "../../../src/db/connection/open";
import { migrate } from "../../../src/db/migrations/migrate";
import { units } from "../../../src/db/models/unit/repo";

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tmp(prefix = "garnish-backup-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

/** A real on-disk database with the full migration set and one unit row. */
async function sourceDb(): Promise<{ db: Database; path: string }> {
  const path = join(tmp(), "garnish.db");
  const db = openDatabase(path);
  await migrate(db);
  units(db).create({ name: "gram", pluralName: "grams", abbreviation: "g", useAbbreviation: true, fraction: false });
  return { db, path };
}

const journalMode = (db: Database) => db.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get()!.journal_mode;
const unitNames = (db: Database) => db.query<{ name: string }, []>("SELECT name FROM unit ORDER BY name").all().map((r) => r.name);

test("backupFileName is garnish-YYYYMMDD-HHmmss.db in UTC", () => {
  expect(backupFileName(new Date("2026-09-10T03:04:05.678Z"))).toBe("garnish-20260910-030405.db");
  expect(backupFileName(new Date("2026-12-31T23:59:59Z"))).toBe("garnish-20261231-235959.db");
  expect(backupFileName(new Date("0999-01-02T00:00:00Z"))).toBe("garnish-09990102-000000.db");
  expect(backupFileName()).toMatch(/^garnish-\d{8}-\d{6}\.db$/);
});

test("backupsDir sits inside the data dir", () => {
  expect(backupsDir("/srv/garnish")).toBe(join("/srv/garnish", BACKUPS_SUBDIR));
  expect(backupsDir("/srv/garnish")).toBe("/srv/garnish/backups");
});

test("backup writes a readable copy into a directory it creates", async () => {
  const { db } = await sourceDb();
  const dir = join(tmp(), "nested", "backups");
  expect(existsSync(dir)).toBe(false);

  const path = backup(db, dir, new Date("2026-09-10T03:04:05Z"));

  expect(path).toBe(join(dir, "garnish-20260910-030405.db"));
  expect(existsSync(path)).toBe(true);

  const copy = new Database(path, { readonly: true, strict: true });
  try {
    expect(unitNames(copy)).toEqual(["gram"]);
    expect(copy.query<{ n: number }, []>("SELECT count(*) AS n FROM migration").get()!.n).toBeGreaterThan(0);
  } finally {
    copy.close();
  }
  db.close();
});

test("two backups a second apart get distinct names", async () => {
  const { db } = await sourceDb();
  const dir = join(tmp(), "backups");
  const first = backup(db, dir, new Date("2026-09-10T03:04:05Z"));
  const second = backup(db, dir, new Date("2026-09-10T03:04:06Z"));
  expect(first).not.toBe(second);
  expect(basename(first)).toBe("garnish-20260910-030405.db");
  expect(basename(second)).toBe("garnish-20260910-030406.db");
  expect(existsSync(first)).toBe(true);
  expect(existsSync(second)).toBe(true);
  db.close();
});

test("backup leaves the source untouched", async () => {
  const { db, path } = await sourceDb();
  const before = { journal: journalMode(db), units: unitNames(db) };
  expect(before.journal).toBe("wal");

  backup(db, join(tmp(), "backups"));

  expect(journalMode(db)).toBe(before.journal);
  expect(unitNames(db)).toEqual(before.units);
  units(db).create({ name: "litre", pluralName: "litres", abbreviation: "l", useAbbreviation: true, fraction: false });
  expect(unitNames(db)).toEqual(["gram", "litre"]);
  db.close();

  const reopened = openDatabase(path);
  try {
    expect(journalMode(reopened)).toBe("wal");
    expect(unitNames(reopened)).toEqual(["gram", "litre"]);
  } finally {
    reopened.close();
  }
});

test("backup refuses to overwrite an existing file", async () => {
  const { db } = await sourceDb();
  const dir = join(tmp(), "backups");
  const at = new Date("2026-09-10T03:04:05Z");
  backup(db, dir, at);
  expect(() => backup(db, dir, at)).toThrow();
  db.close();
});
