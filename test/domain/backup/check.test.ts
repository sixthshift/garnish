// The backup format (M40.1): a garnish backup parses, and every reason one
// cannot be restored is named before a restore touches anything.
import { describe, expect, test } from "vitest";
import { type Backup, backupFileName, checkBackup, countsOf, imageFileOf, imagePath, imagePathsOf } from "../../../src/domain/backup";
import { IDS, sampleBackup } from "../../helpers/backup";

const problemsOf = (json: unknown): string[] => {
  const result = checkBackup(json);
  return result.ok ? [] : result.problems;
};

test("a backup with one row of every kind passes", () => {
  const result = checkBackup(sampleBackup());
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(countsOf(result.backup)).toEqual({
    recipes: 1,
    foods: 2,
    units: 2,
    aisles: 1,
    tags: 1,
    timeline: 1,
    plan: 1,
    shopping: 1,
    styleRules: 1,
    plannerRules: 1,
    images: 3,
  });
});

test("it round-trips through JSON unchanged", () => {
  const result = checkBackup(JSON.parse(JSON.stringify(sampleBackup())));
  expect(result.ok && result.backup).toEqual(sampleBackup());
});

describe("what is not a backup", () => {
  test("another file", () => {
    expect(problemsOf({ recipes: [] })).toEqual(["This is not a garnish backup"]);
    expect(problemsOf(null)).toEqual(["This is not a garnish backup"]);
    expect(problemsOf({ ...sampleBackup(), garnish: { ...sampleBackup().garnish, format: "garnish-export" } })).toEqual(["This is not a garnish backup"]);
  });

  test("a newer version is named", () => {
    const backup = sampleBackup();
    expect(problemsOf({ ...backup, garnish: { ...backup.garnish, version: 3 } })).toEqual([
      "This backup is from a newer garnish (backup version 3); update garnish before restoring it",
    ]);
  });

  test("a schema failure says where", () => {
    const backup = sampleBackup();
    backup.recipes[0]!.name = "";
    (backup.plan[0] as unknown as { meal: string }).meal = "supper";
    const problems = problemsOf(backup);
    expect(problems.some((line) => line.startsWith("recipes[0].name:"))).toBe(true);
    expect(problems.some((line) => line.startsWith("plan[0].meal:"))).toBe(true);
  });

  test("an image path outside its folder", () => {
    const backup = sampleBackup();
    backup.recipes[0]!.parts[0]!.steps[0]!.image = `images/${IDS.step}.png`;
    backup.timeline[0]!.image = "../garnish.db";
    const problems = problemsOf(backup);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/^recipes\[0\]\.parts\[0\]\.steps\[0\]\.image: not a step image path/);
    expect(problems[1]).toMatch(/^timeline\[0\]\.image: not a timeline image path/);
  });
});

describe("references", () => {
  const missing = "99999999-0000-4000-8000-000000000000";
  const cases: [string, (b: Backup) => void, string][] = [
    ["unit.standardUnitId", (b) => (b.units[1]!.standardUnitId = missing), "units[1].standardUnitId"],
    ["food.aisleId", (b) => (b.foods[0]!.aisleId = missing), "foods[0].aisleId"],
    ["food.recipeId", (b) => (b.foods[1]!.recipeId = missing), "foods[1].recipeId"],
    ["conversion.unitId", (b) => (b.foods[0]!.conversions[0]!.unitId = missing), "foods[0].conversions[0].unitId"],
    ["conversion.toUnitId", (b) => (b.foods[0]!.conversions[0]!.toUnitId = missing), "foods[0].conversions[0].toUnitId"],
    ["recipe.yieldUnitId", (b) => (b.recipes[0]!.yieldUnitId = missing), "recipes[0].yieldUnitId"],
    ["recipe.tagIds", (b) => (b.recipes[0]!.tagIds = [missing]), "recipes[0].tagIds[0]"],
    ["ingredient.unitId", (b) => (b.recipes[0]!.parts[0]!.ingredients[0]!.unitId = missing), "recipes[0].parts[0].ingredients[0].unitId"],
    ["ingredient.foodId", (b) => (b.recipes[0]!.parts[0]!.ingredients[0]!.foodId = missing), "recipes[0].parts[0].ingredients[0].foodId"],
    ["timeline.recipeId", (b) => (b.timeline[0]!.recipeId = missing), "timeline[0].recipeId"],
    ["plan.recipeId", (b) => (b.plan[0]!.recipeId = missing), "plan[0].recipeId"],
    ["shopping.unitId", (b) => (b.shopping[0]!.unitId = missing), "shopping[0].unitId"],
    ["shopping.foodId", (b) => (b.shopping[0]!.foodId = missing), "shopping[0].foodId"],
    ["source.recipeId", (b) => (b.shopping[0]!.sources[0]!.recipeId = missing), "shopping[0].sources[0].recipeId"],
  ];
  test.each(cases)("%s naming nothing is a problem", (_, breakIt, where) => {
    const backup = sampleBackup();
    breakIt(backup);
    expect(problemsOf(backup)).toEqual([expect.stringMatching(new RegExp(`^${where.replace(/[[\].]/g, "\\$&")}: .* is not in the backup$`))]);
  });

  test("a step linking an ingredient of another part", () => {
    const backup = sampleBackup();
    backup.recipes[0]!.parts[0]!.steps[0]!.ingredientIds = [missing];
    expect(problemsOf(backup)).toEqual([`recipes[0].parts[0].steps[0].ingredientIds[0]: ingredient ${missing} is not in the step's part`]);
  });

  test("null references are fine", () => {
    const backup = sampleBackup();
    backup.plan[0]!.recipeId = null;
    backup.shopping[0]!.foodId = null;
    expect(checkBackup(backup).ok).toBe(true);
  });
});

describe("what the database would refuse", () => {
  test("an id twice in one table", () => {
    const backup = sampleBackup();
    backup.aisles.push({ id: IDS.aisle, name: "Bakery", position: 1 });
    expect(problemsOf(backup)).toEqual([`aisles[1]: aisle id ${IDS.aisle} appears twice`]);
  });

  test("names unique without case, slugs unique exactly", () => {
    const backup = sampleBackup();
    backup.foods.push({ ...backup.foods[0]!, id: "d0000000-0000-4000-8000-000000000009", name: "Butter", conversions: [] });
    backup.recipes.push({
      ...backup.recipes[0]!,
      id: "f0000000-0000-4000-8000-000000000009",
      parts: [{ id: "f2000000-0000-4000-8000-000000000009", name: "", ingredients: [], steps: [] }],
      notes: [],
    });
    expect(problemsOf(backup)).toEqual([
      'foods[2]: food name "Butter" is already used at foods[0]',
      'recipes[1]: recipe slug "hollandaise" is already used at recipes[0]',
    ]);
  });
});

test("image paths", () => {
  expect(imagePath("recipe", "a.png")).toBe("images/a.png");
  expect(imagePath("step", null)).toBeNull();
  expect(imagePath("timeline", " ")).toBeNull();
  expect(imageFileOf("step", `images/steps/${IDS.step}.png`)).toBe(`${IDS.step}.png`);
  expect(imageFileOf("recipe", `images/steps/${IDS.step}.png`)).toBeNull();
  expect(imageFileOf("recipe", "images/../garnish.db")).toBeNull();
  const result = checkBackup(sampleBackup());
  expect(result.ok && imagePathsOf(result.backup)).toEqual([`images/${IDS.recipe}.png`, `images/steps/${IDS.step}.png`, `images/timeline/${IDS.event}.png`]);
});

test("backupFileName is the UTC moment", () => {
  expect(backupFileName(new Date("2026-10-07T09:15:03Z"))).toBe("garnish-backup-20261007-091503.zip");
});
