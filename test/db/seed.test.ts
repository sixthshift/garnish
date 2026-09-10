import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { migrate, openDatabase } from "../../src/db/migrate";
import { DEFAULT_UNITS, seed } from "../../src/db/seed";
import { units } from "../../src/db/units";

let db: Database;
beforeEach(async () => {
  db = openDatabase(":memory:");
  await migrate(db);
});

const count = () => db.query<{ n: number }, []>("SELECT count(*) AS n FROM unit").get()!.n;

test("seeds the default units once", () => {
  const first = seed(db);
  expect(first.units).toHaveLength(DEFAULT_UNITS.length);
  expect(count()).toBe(DEFAULT_UNITS.length);
  expect(units(db).list().map((u) => u.name)).toEqual(
    expect.arrayContaining(["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "oz", "lb", "pinch", "piece", "slice", "clove", "can", "bunch"].map(abbrevToName)),
  );
});

test("seeding twice leaves the count unchanged", () => {
  seed(db);
  const before = count();
  const second = seed(db);
  expect(second.units).toEqual([]);
  expect(count()).toBe(before);
});

test("matches existing rows case-insensitively and keeps them", () => {
  const mine = units(db).create({ name: "Cup", pluralName: "cups", abbreviation: "c" });
  seed(db);
  expect(count()).toBe(DEFAULT_UNITS.length);
  expect(units(db).get(mine.id)).toEqual(mine);
});

test("metric and imperial spot checks", () => {
  seed(db);
  const all = units(db).list();
  const byName = (name: string) => all.find((u) => u.name === name);

  expect(byName("millilitre")).toMatchObject({
    pluralName: "millilitres",
    abbreviation: "ml",
    useAbbreviation: true,
    fraction: false,
  });
  expect(byName("pound")).toMatchObject({ pluralName: "pounds", abbreviation: "lb", useAbbreviation: true, fraction: false });
  expect(byName("cup")).toMatchObject({ pluralName: "cups", fraction: true });
  expect(byName("clove")).toMatchObject({ pluralName: "cloves", fraction: true });
});

test("default names and abbreviations are unique", () => {
  const names = DEFAULT_UNITS.map((u) => u.name.toLowerCase());
  expect(new Set(names).size).toBe(names.length);
  const abbrs = DEFAULT_UNITS.map((u) => u.abbreviation);
  expect(new Set(abbrs).size).toBe(abbrs.length);
});

function abbrevToName(abbr: string): string {
  return DEFAULT_UNITS.find((u) => u.abbreviation === abbr || u.name === abbr)!.name;
}
