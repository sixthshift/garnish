import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../../src/db/connection/open";
import { migrate } from "../../../src/db/migrations/migrate";
import { styleRuleRepository } from "../../../src/db/models/style/repo";
import { unitRepository } from "../../../src/db/models/unit/repo";
import { seed } from "../../../src/db/seed/seed";
import { DEFAULT_STYLE_RULES } from "../../../src/db/seed/style";
import { DEFAULT_UNITS } from "../../../src/db/seed/units";

let db: Database;
beforeEach(async () => {
  db = openDatabase(":memory:");
  migrate(db);
});

const count = () => db.query<{ n: number }, []>("SELECT count(*) AS n FROM unit").get()!.n;
const styleCount = () => db.query<{ n: number }, []>("SELECT count(*) AS n FROM style_rule").get()!.n;

test("seeds the default units once", () => {
  const first = seed(db);
  expect(first.units).toHaveLength(DEFAULT_UNITS.length);
  expect(count()).toBe(DEFAULT_UNITS.length);
  expect(
    unitRepository(db)
      .list()
      .map((u) => u.name)
  ).toEqual(
    expect.arrayContaining(["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "oz", "lb", "pinch", "piece", "slice", "clove", "can", "bunch"].map(abbrevToName))
  );
});

test("seeding twice leaves the count unchanged", () => {
  seed(db);
  const before = count();
  const beforeRules = styleCount();
  const second = seed(db);
  expect(second.units).toEqual([]);
  expect(second.styleRules).toEqual([]);
  expect(count()).toBe(before);
  expect(styleCount()).toBe(beforeRules);
});

test("seeds the house style guide once, in order, ten of fourteen on", () => {
  const first = seed(db);
  expect(first.styleRules).toHaveLength(DEFAULT_STYLE_RULES.length);
  const guide = styleRuleRepository(db).list();
  expect(guide.map((r) => r.text)).toEqual(DEFAULT_STYLE_RULES.map((r) => r.text));
  expect(guide.map((r) => r.position)).toEqual(DEFAULT_STYLE_RULES.map((_, i) => i));
  expect(guide.filter((r) => r.enabled).map((r) => r.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("a statement is matched by its whole text case-insensitively, so an edit is kept and a rewording is a new row", () => {
  const repo = styleRuleRepository(db);
  // The household's own wording of statement one, switched off.
  const mine = repo.create({ text: "ONE ACTION PER STEP: SPLIT A PARAGRAPH THAT DOES SEVERAL THINGS.", enabled: false });
  const reworded = repo.create({ text: "No chatter at all.", enabled: false });
  const { styleRules: made } = seed(db);

  expect(repo.get(mine.id)).toEqual(mine);
  expect(made.map((r) => r.text)).not.toContain(DEFAULT_STYLE_RULES[0]!.text);
  // The reworded one did not match anything, so the statement it replaced comes back.
  expect(made.map((r) => r.text)).toContain("No chatter: drop asides, encouragement and references to the blog.");
  expect(styleCount()).toBe(DEFAULT_STYLE_RULES.length + 1);
  expect(repo.get(reworded.id)).toEqual(reworded);
});

test("matches existing rows case-insensitively and keeps them", () => {
  const mine = unitRepository(db).create({ name: "Cup", pluralName: "cups", abbreviation: "c" });
  seed(db);
  expect(count()).toBe(DEFAULT_UNITS.length);
  expect(unitRepository(db).get(mine.id)).toEqual(mine);
});

test("metric and imperial spot checks", () => {
  seed(db);
  const all = unitRepository(db).list();
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
