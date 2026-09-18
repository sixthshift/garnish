// Meal plan repository against :memory: with the real migrations: a week read
// as seven days, the round trip of both kinds of entry, moving between days and
// within one, and the recipe delete that must not take a planned day with it.
import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../src/db/connection/open";
import { migrate } from "../../src/db/migrations/migrate";
import { type PlanRepository, planRepository } from "../../src/db/models/plan/repo";
import { recipeRepository } from "../../src/db/models/recipe/repo";
import { type PlanEntryInput, planDaySchema, planEntryInputSchema, planEntrySchema } from "../../src/domain/plan";
import { type RecipeInput, recipeInputSchema } from "../../src/domain/recipe";

let db: Database;
let repo: PlanRepository;

const MONDAY = "2026-09-14";
const TUESDAY = "2026-09-15";
const SUNDAY = "2026-09-20";

const parse = (input: PlanEntryInput) => planEntryInputSchema.parse(input);

beforeEach(async () => {
  db = openDatabase(":memory:");
  migrate(db);
  repo = planRepository(db);
});

function seedRecipe(name = "Lemon tart"): { id: string; slug: string } {
  const doc: RecipeInput = { name, parts: [{ name: "", ingredients: [], steps: [] }] };
  const created = recipeRepository(db).create(recipeInputSchema.parse(doc));
  return { id: created.id, slug: created.slug };
}

/** The week's entry texts (or recipe names) day by day. */
function labels(monday = MONDAY): string[][] {
  return repo.week(monday).map((day) => day.entries.map((e) => e.recipe?.name ?? e.text));
}

test("an empty plan reads as seven empty days", () => {
  const week = repo.week(MONDAY);
  expect(week.map((d) => d.date)).toEqual([MONDAY, TUESDAY, "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", SUNDAY]);
  expect(week.every((d) => d.entries.length === 0)).toBe(true);
  expect(week.every((d) => planDaySchema.safeParse(d).success)).toBe(true);
  expect(repo.get("11111111-1111-4111-8111-111111111111")).toBeNull();
});

test("a recipe entry round-trips with the recipe's summary fields", () => {
  const recipe = seedRecipe();
  const entry = repo.add(parse({ date: TUESDAY, recipeId: recipe.id, servings: 6 }));

  expect(planEntrySchema.safeParse(entry).success).toBe(true);
  expect(entry).toMatchObject({
    date: TUESDAY,
    position: 0,
    text: "",
    servings: 6,
    recipe: { id: recipe.id, slug: recipe.slug, name: "Lemon tart", image: null },
  });
  expect(repo.get(entry.id)).toEqual(entry);
  expect(repo.week(MONDAY)[1]!.entries).toEqual([entry]);
});

test("a plain line round-trips with no recipe", () => {
  const entry = repo.add(parse({ date: MONDAY, text: "Leftovers" }));
  expect(entry).toMatchObject({ date: MONDAY, position: 0, text: "Leftovers", recipe: null, servings: null });
  expect(labels()).toEqual([["Leftovers"], [], [], [], [], [], []]);
});

test("an entry carries its meal, or none, and the order is still position (M39.1)", () => {
  const breakfast = repo.add(parse({ date: MONDAY, text: "Porridge", meal: "breakfast" }));
  const untyped = repo.add(parse({ date: MONDAY, text: "Leftovers" }));

  expect(breakfast.meal).toBe("breakfast");
  expect(planEntrySchema.safeParse(breakfast).success).toBe(true);
  // An entry with no chip pressed is what a hand-typed line has always been.
  expect(untyped.meal).toBeNull();
  expect(repo.get(breakfast.id)).toEqual(breakfast);
  expect(repo.week(MONDAY)[0]!.entries).toEqual([breakfast, untyped]);
  // The meal labels; it does not sort. Both entries sit in the order they were added.
  expect(repo.week(MONDAY)[0]!.entries.map((e) => e.position)).toEqual([0, 1]);

  // The patch sets it, clears it, and is left out without disturbing it.
  expect(repo.update(untyped.id, { meal: "dinner" })).toMatchObject({ meal: "dinner", text: "Leftovers" });
  expect(repo.update(untyped.id, { servings: 2 })).toMatchObject({ meal: "dinner" });
  expect(repo.update(untyped.id, { meal: null })).toMatchObject({ meal: null });
});

test("the meal column refuses anything but the three meals", () => {
  const entry = repo.add(parse({ date: MONDAY, text: "Snack" }));
  expect(() => db.query("UPDATE meal_plan_entry SET meal = 'side' WHERE id = ?").run(entry.id)).toThrow();
});

test("entries append to the end of their own day, each day numbered from zero", () => {
  repo.add(parse({ date: MONDAY, text: "One" }));
  repo.add(parse({ date: TUESDAY, text: "Two" }));
  repo.add(parse({ date: MONDAY, text: "Three" }));

  expect(labels()).toEqual([["One", "Three"], ["Two"], [], [], [], [], []]);
  expect(repo.week(MONDAY)[0]!.entries.map((e) => e.position)).toEqual([0, 1]);
  expect(repo.week(MONDAY)[1]!.entries.map((e) => e.position)).toEqual([0]);
});

test("the week is a range: the days either side of it are not in it", () => {
  repo.add(parse({ date: "2026-09-13", text: "Before" })); // the Sunday before
  repo.add(parse({ date: SUNDAY, text: "Sunday" }));
  repo.add(parse({ date: "2026-09-21", text: "After" })); // the Monday after

  expect(labels()).toEqual([[], [], [], [], [], [], ["Sunday"]]);
  expect(labels("2026-09-07")[6]).toEqual(["Before"]);
  expect(labels("2026-09-21")[0]).toEqual(["After"]);
});

test("update patches an entry and leaves the rest alone", () => {
  const recipe = seedRecipe();
  const entry = repo.add(parse({ date: MONDAY, recipeId: recipe.id }));

  expect(repo.update(entry.id, { servings: 4 })).toMatchObject({ servings: 4, date: MONDAY, position: 0 });
  expect(repo.update(entry.id, {})).toMatchObject({ servings: 4 });
  expect(repo.update(entry.id, { recipeId: null, text: "Out" })).toMatchObject({ recipe: null, text: "Out" });
  expect(repo.update("11111111-1111-4111-8111-111111111111", { servings: 2 })).toBeNull();
});

test("move reorders within a day", () => {
  repo.add(parse({ date: MONDAY, text: "One" }));
  repo.add(parse({ date: MONDAY, text: "Two" }));
  const third = repo.add(parse({ date: MONDAY, text: "Three" }));

  expect(repo.move(third.id, MONDAY, 0)).toMatchObject({ date: MONDAY, position: 0 });
  expect(labels()[0]).toEqual(["Three", "One", "Two"]);
  expect(repo.week(MONDAY)[0]!.entries.map((e) => e.position)).toEqual([0, 1, 2]);
});

test("move to another day closes the gap behind it and opens one ahead", () => {
  const one = repo.add(parse({ date: MONDAY, text: "One" }));
  repo.add(parse({ date: MONDAY, text: "Two" }));
  repo.add(parse({ date: TUESDAY, text: "Three" }));

  expect(repo.move(one.id, TUESDAY, 0)).toMatchObject({ date: TUESDAY, position: 0 });
  expect(labels()).toEqual([["Two"], ["One", "Three"], [], [], [], [], []]);
  expect(repo.week(MONDAY)[0]!.entries.map((e) => e.position)).toEqual([0]);
  expect(repo.week(MONDAY)[1]!.entries.map((e) => e.position)).toEqual([0, 1]);
});

test("a position past the end of the day lands at the end, and an unknown id is null", () => {
  const one = repo.add(parse({ date: MONDAY, text: "One" }));
  repo.add(parse({ date: TUESDAY, text: "Two" }));

  expect(repo.move(one.id, TUESDAY, 99)).toMatchObject({ position: 1 });
  expect(labels()[1]).toEqual(["Two", "One"]);
  expect(repo.move("11111111-1111-4111-8111-111111111111", MONDAY, 0)).toBeNull();
});

test("move across the week's edge takes the entry out of the week", () => {
  const one = repo.add(parse({ date: MONDAY, text: "One" }));
  repo.move(one.id, "2026-09-21", 0);
  expect(labels()).toEqual([[], [], [], [], [], [], []]);
  expect(labels("2026-09-21")[0]).toEqual(["One"]);
});

test("remove deletes one entry and answers false for an unknown id", () => {
  const entry = repo.add(parse({ date: MONDAY, text: "One" }));
  expect(repo.remove(entry.id)).toBe(true);
  expect(repo.get(entry.id)).toBeNull();
  expect(repo.remove(entry.id)).toBe(false);
});

test("deleting the recipe leaves the day's entry, with no recipe on it", () => {
  const recipe = seedRecipe();
  const entry = repo.add(parse({ date: MONDAY, recipeId: recipe.id, servings: 4 }));

  recipeRepository(db).remove(recipe.id);

  const after = repo.get(entry.id);
  expect(after).toMatchObject({ id: entry.id, date: MONDAY, recipe: null, servings: 4 });
  expect(repo.week(MONDAY)[0]!.entries).toHaveLength(1);
});

test("one select answers a week of entries pointing at the same recipe", () => {
  const recipe = seedRecipe();
  const other = seedRecipe("Pasta");
  repo.add(parse({ date: MONDAY, recipeId: recipe.id }));
  repo.add(parse({ date: TUESDAY, recipeId: recipe.id }));
  repo.add(parse({ date: TUESDAY, recipeId: other.id }));

  expect(labels()).toEqual([["Lemon tart"], ["Lemon tart", "Pasta"], [], [], [], [], []]);
});
