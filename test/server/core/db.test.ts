import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { DB_FILE } from "../../../src/db/connection/open";
import { listMigrations, MIGRATIONS_DIR } from "../../../src/db/migrations/migrate";
import { units } from "../../../src/db/models/unit/repo";
import { DEFAULT_UNITS } from "../../../src/db/seed/units";
import { bundledMigrations, closeDb, getDb } from "../../../src/server/core/db";
import { useTempDataDir } from "../../helpers/server";

const temp = useTempDataDir();

test("first getDb creates the file under DATA_DIR, migrates and seeds", async () => {
  expect(existsSync(join(temp.dir, DB_FILE))).toBe(false);
  const db = getDb();
  expect(existsSync(join(temp.dir, DB_FILE))).toBe(true);
  const applied = db.query<{ n: number }, []>("SELECT count(*) AS n FROM migration").get()!.n;
  expect(applied).toBeGreaterThan(0);
  expect(units(db).list()).toHaveLength(DEFAULT_UNITS.length);
});

test("getDb caches the handle and does not re-seed", async () => {
  const a = getDb();
  const b = getDb();
  expect(b).toBe(a);
  expect(units(a).list()).toHaveLength(DEFAULT_UNITS.length);
});

test("closeDb forgets the handle; the next getDb reopens the same file", async () => {
  const a = getDb();
  units(a).create({ name: "handful", pluralName: "handfuls", abbreviation: "hf" });
  closeDb();
  const b = getDb();
  expect(b).not.toBe(a);
  expect(
    units(b)
      .list()
      .map((u) => u.name)
  ).toContain("handful");
  expect(units(b).list()).toHaveLength(DEFAULT_UNITS.length + 1);
});

test("closeDb with nothing open is a no-op", async () => {
  expect(closeDb()).toBeUndefined();
});

test("the bundled migrations match the files on disk", () => {
  const bundled = bundledMigrations();
  const onDisk = listMigrations(MIGRATIONS_DIR).map((m) => m.file);
  expect(Object.keys(bundled).sort()).toEqual(onDisk);
  for (const file of onDisk) expect(bundled[file]).toBe(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
});
