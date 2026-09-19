import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../../src/db/connection/open";
import { migrate } from "../../../src/db/migrations/migrate";
import { plannerRepository } from "../../../src/db/models/planner/repo";
import { styleRuleRepository } from "../../../src/db/models/style/repo";
import { unitRepository } from "../../../src/db/models/unit/repo";
import { DEFAULT_PLANNER_RULES } from "../../../src/db/seed/planner";
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
const plannerCount = () => db.query<{ n: number }, []>("SELECT count(*) AS n FROM planner_rule").get()!.n;

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
  const beforePlanner = plannerCount();
  const second = seed(db);
  expect(second.units).toEqual([]);
  expect(second.styleRules).toEqual([]);
  expect(second.rewordedStyleRules).toEqual([]);
  expect(second.retiredStyleRules).toEqual([]);
  expect(second.plannerRules).toEqual([]);
  expect(second.rewordedPlannerRules).toEqual([]);
  expect(second.retiredPlannerRules).toEqual([]);
  expect(count()).toBe(before);
  expect(styleCount()).toBe(beforeRules);
  expect(plannerCount()).toBe(beforePlanner);
});

// The planner guide goes through the same `seedStatements` helper as the house
// style, so what is checked here is that it is wired to it, seeded in order,
// and that an edited row survives a re-seed the same way.
test("seeds the planner guide once, in order, five of seven on", () => {
  const first = seed(db);
  expect(first.plannerRules).toHaveLength(DEFAULT_PLANNER_RULES.length);
  expect(first.rewordedPlannerRules).toEqual([]);
  expect(first.retiredPlannerRules).toEqual([]);
  const guide = plannerRepository(db).rules.list();
  expect(guide.map((r) => r.text)).toEqual(DEFAULT_PLANNER_RULES.map((r) => r.text));
  expect(guide.map((r) => r.position)).toEqual(DEFAULT_PLANNER_RULES.map((_, i) => i));
  expect(guide.filter((r) => r.enabled).map((r) => r.position)).toEqual([0, 1, 2, 3, 4]);
  expect(guide.filter((r) => !r.enabled).map((r) => r.text)).toEqual([
    "Two vegetarian dinners a week.",
    "A big-batch dinner may be the next day's lunch as leftovers.",
  ]);
});

test("a planner statement is matched by its whole text case-insensitively, so an edited row is kept and never duplicated", () => {
  const rules = plannerRepository(db).rules;
  const mine = rules.create({ text: DEFAULT_PLANNER_RULES[3]!.text.toUpperCase(), enabled: false });
  const own = rules.create({ text: "No takeaway on a Thursday." });
  const { plannerRules: made } = seed(db);

  expect(rules.get(mine.id)).toEqual(mine);
  expect(rules.get(own.id)).toEqual(own);
  expect(made.map((r) => r.text)).not.toContain(DEFAULT_PLANNER_RULES[3]!.text);
  expect(plannerCount()).toBe(DEFAULT_PLANNER_RULES.length + 1);
  expect(seed(db).plannerRules).toEqual([]);
});

test("the two guides are seeded separately: neither's statements land in the other's table", () => {
  seed(db);
  const planner = plannerRepository(db)
    .rules.list()
    .map((r) => r.text);
  const style = styleRuleRepository(db)
    .list()
    .map((r) => r.text);
  expect(planner.some((text) => style.includes(text))).toBe(false);
  expect(styleCount()).toBe(DEFAULT_STYLE_RULES.length);
  expect(plannerCount()).toBe(DEFAULT_PLANNER_RULES.length);
});

test("seeds the house style guide once, in order, all eleven on", () => {
  const first = seed(db);
  expect(first.styleRules).toHaveLength(DEFAULT_STYLE_RULES.length);
  expect(first.rewordedStyleRules).toEqual([]);
  expect(first.retiredStyleRules).toEqual([]);
  const guide = styleRuleRepository(db).list();
  expect(guide.map((r) => r.text)).toEqual(DEFAULT_STYLE_RULES.map((r) => r.text));
  expect(guide.map((r) => r.position)).toEqual(DEFAULT_STYLE_RULES.map((_, i) => i));
  expect(guide.filter((r) => r.enabled).map((r) => r.position)).toEqual(DEFAULT_STYLE_RULES.map((_, i) => i));
});

test("a statement is matched by its whole text case-insensitively, so an edit is kept and a rewording is a new row", () => {
  const repo = styleRuleRepository(db);
  // The household's own wording of the plating statement, switched on.
  const mine = repo.create({ text: "PREFER METRIC: WHERE A STEP GIVES BOTH, KEEP ONLY METRIC.", enabled: true });
  const reworded = repo.create({ text: "No chatter at all.", enabled: false });
  const { styleRules: made } = seed(db);

  expect(repo.get(mine.id)).toEqual(mine);
  expect(made.map((r) => r.text)).not.toContain(DEFAULT_STYLE_RULES.find((r) => r.text.startsWith("Prefer metric"))!.text);
  // The reworded one did not match anything, so the statement it replaced comes back.
  expect(made.map((r) => r.text)).toContain(DEFAULT_STYLE_RULES.find((r) => r.text.startsWith("Drop what is about"))!.text);
  expect(styleCount()).toBe(DEFAULT_STYLE_RULES.length + 1);
  expect(repo.get(reworded.id)).toEqual(reworded);
});

test("a row still carrying a sentence this project reworded is given the new one in place, keeping its switch and position", () => {
  const repo = styleRuleRepository(db);
  const voice = DEFAULT_STYLE_RULES.find((r) => r.text.startsWith("Imperative"))!;
  const timing = DEFAULT_STYLE_RULES.find((r) => r.text.startsWith("Flag parallel work"))!;
  // The old sentences as a database seeded before the rewording holds them: one switched on and moved, one switched off.
  const oldVoice = repo.create({ text: voice.was![0]!.toUpperCase(), enabled: true });
  const oldTiming = repo.create({ text: timing.was![0]!, enabled: false });
  const { styleRules: made, rewordedStyleRules: reworded } = seed(db);

  expect(reworded.map((r) => r.id).sort()).toEqual([oldVoice.id, oldTiming.id].sort());
  expect(repo.get(oldVoice.id)).toMatchObject({ text: voice.text, enabled: true, position: oldVoice.position });
  expect(repo.get(oldTiming.id)).toMatchObject({ text: timing.text, enabled: false, position: oldTiming.position });
  expect(made.map((r) => r.text)).not.toContain(voice.text);
  expect(made.map((r) => r.text)).not.toContain(timing.text);
  expect(styleCount()).toBe(DEFAULT_STYLE_RULES.length);
  // Seeding again finds nothing to do.
  expect(seed(db).rewordedStyleRules).toEqual([]);
});

test("the other sentences a statement absorbed are removed, whether or not the statement itself is already there", () => {
  const repo = styleRuleRepository(db);
  const stage = DEFAULT_STYLE_RULES[0]!;
  const voice = DEFAULT_STYLE_RULES[1]!;
  // A guide from the fourteen-statement days: the old step-size trio, and both halves of the voice statement.
  const [oldStage, oldMerge, oldOrder] = [stage.was![0]!, stage.was![3]!, stage.was![4]!].map((text) => repo.create({ text }));
  const imperative = repo.create({ text: voice.was![0]! });
  const plain = repo.create({ text: voice.was![1]!, enabled: false });
  // The household already has the new voice sentence too.
  const already = repo.create({ text: voice.text });
  const { rewordedStyleRules: reworded, retiredStyleRules: retired } = seed(db);

  expect(reworded.map((r) => r.id)).toEqual([oldStage!.id]);
  expect(retired.map((r) => r.id).sort()).toEqual([oldMerge!.id, oldOrder!.id, imperative.id, plain.id].sort());
  expect(repo.get(oldStage!.id)?.text).toBe(stage.text);
  expect(repo.get(already.id)).toEqual(already);
  expect(repo.get(imperative.id)).toBeNull();
  expect(styleCount()).toBe(DEFAULT_STYLE_RULES.length);
  expect(seed(db).retiredStyleRules).toEqual([]);
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
