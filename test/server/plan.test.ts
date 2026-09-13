// Meal plan server functions against a temp DATA_DIR: one test per function,
// the validation each rejects, and not-found for the writes that name an entry
// by id.
import { isNotFound } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { planDaySchema } from "../../src/domain/plan";
import type { RecipeInput } from "../../src/domain/recipe";
import { addPlanEntry, listPlanWeek, movePlanEntry, removePlanEntry, updatePlanEntry } from "../../src/server/plan";
import { createRecipe, deleteRecipe } from "../../src/server/recipes";
import type { NotFoundData } from "../../src/server/fn";
import { callServerFn, useTempDataDir } from "../helpers/server";

useTempDataDir();

const MISSING = "00000000-0000-4000-8000-000000000000";
const MONDAY = "2026-09-14";
const TUESDAY = "2026-09-15";

async function notFoundData(promise: Promise<unknown>): Promise<NotFoundData> {
  const caught = await promise.catch((e: unknown) => e);
  expect(isNotFound(caught)).toBe(true);
  return (caught as { data: NotFoundData }).data;
}

const newRecipe = (name = "Lemon tart") =>
  callServerFn(createRecipe, { name, parts: [{ name: "", ingredients: [], steps: [] }] } as RecipeInput);

/** The week's entry labels day by day. */
async function labels(monday = MONDAY): Promise<string[][]> {
  const week = await callServerFn(listPlanWeek, { monday });
  return week.map((day) => day.entries.map((e) => e.recipe?.name ?? e.text));
}

test("the week starts as seven empty days", async () => {
  const week = await callServerFn(listPlanWeek, { monday: MONDAY });
  expect(week).toHaveLength(7);
  expect(week.map((d) => d.date)[0]).toBe(MONDAY);
  expect(week.map((d) => d.date)[6]).toBe("2026-09-20");
  expect(week.every((d) => planDaySchema.safeParse(d).success)).toBe(true);
});

test("listPlanWeek rejects a monday that is not a date", async () => {
  await expect(callServerFn(listPlanWeek, { monday: "next week" } as never)).rejects.toThrow();
  await expect(callServerFn(listPlanWeek, { monday: "2026-02-30" } as never)).rejects.toThrow();
});

test("addPlanEntry plans a recipe with the summary fields the week draws", async () => {
  const recipe = await newRecipe();
  const entry = await callServerFn(addPlanEntry, { date: TUESDAY, recipeId: recipe.id, servings: 6 });

  expect(entry).toMatchObject({
    date: TUESDAY,
    position: 0,
    servings: 6,
    text: "",
    recipe: { id: recipe.id, slug: recipe.slug, name: "Lemon tart", image: null },
  });
  expect(await labels()).toEqual([[], ["Lemon tart"], [], [], [], [], []]);
});

test("addPlanEntry plans a plain line, and refuses an entry that is neither", async () => {
  const entry = await callServerFn(addPlanEntry, { date: MONDAY, text: "Leftovers" });
  expect(entry).toMatchObject({ date: MONDAY, text: "Leftovers", recipe: null, servings: null });

  await expect(callServerFn(addPlanEntry, { date: MONDAY } as never)).rejects.toThrow();
  await expect(callServerFn(addPlanEntry, { date: MONDAY, text: "  " } as never)).rejects.toThrow();
  await expect(callServerFn(addPlanEntry, { date: MONDAY, text: "x", servings: 0 } as never)).rejects.toThrow();
});

test("updatePlanEntry patches one entry and misses on an unknown id", async () => {
  const recipe = await newRecipe();
  const entry = await callServerFn(addPlanEntry, { date: MONDAY, recipeId: recipe.id });

  expect(await callServerFn(updatePlanEntry, { id: entry.id, servings: 4 })).toMatchObject({ servings: 4 });
  expect(await callServerFn(updatePlanEntry, { id: entry.id, recipeId: null, text: "Out" })).toMatchObject({
    recipe: null,
    text: "Out",
  });

  expect(await notFoundData(callServerFn(updatePlanEntry, { id: MISSING, servings: 2 }))).toMatchObject({
    entity: "plan entry",
    id: MISSING,
  });
});

test("movePlanEntry moves between days and renumbers both, and misses on an unknown id", async () => {
  const one = await callServerFn(addPlanEntry, { date: MONDAY, text: "One" });
  await callServerFn(addPlanEntry, { date: MONDAY, text: "Two" });
  await callServerFn(addPlanEntry, { date: TUESDAY, text: "Three" });

  expect(await callServerFn(movePlanEntry, { id: one.id, date: TUESDAY, position: 0 })).toMatchObject({
    date: TUESDAY,
    position: 0,
  });
  expect(await labels()).toEqual([["Two"], ["One", "Three"], [], [], [], [], []]);

  expect(await notFoundData(callServerFn(movePlanEntry, { id: MISSING, date: MONDAY, position: 0 }))).toMatchObject({
    entity: "plan entry",
  });
  await expect(callServerFn(movePlanEntry, { id: one.id, date: MONDAY, position: -1 } as never)).rejects.toThrow();
});

test("removePlanEntry deletes one entry and misses on an unknown id", async () => {
  const one = await callServerFn(addPlanEntry, { date: MONDAY, text: "One" });
  await callServerFn(addPlanEntry, { date: MONDAY, text: "Two" });

  expect(await callServerFn(removePlanEntry, { id: one.id })).toEqual({ id: one.id });
  expect(await labels()).toEqual([["Two"], [], [], [], [], [], []]);
  await notFoundData(callServerFn(removePlanEntry, { id: one.id }));
});

test("deleting a planned recipe leaves the day's entry behind", async () => {
  const recipe = await newRecipe();
  const entry = await callServerFn(addPlanEntry, { date: MONDAY, recipeId: recipe.id, text: "Lemon tart" });

  await callServerFn(deleteRecipe, { id: recipe.id });

  const week = await callServerFn(listPlanWeek, { monday: MONDAY });
  expect(week[0]!.entries).toHaveLength(1);
  expect(week[0]!.entries[0]).toMatchObject({ id: entry.id, recipe: null, text: "Lemon tart" });
});
