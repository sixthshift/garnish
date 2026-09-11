// Timeline server functions against a temp DATA_DIR: one test per function,
// the last-made bookkeeping they drive, validation failures and not-found.
import { isNotFound } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { timelineEventSchema, type RecipeInput } from "../../src/domain/recipe";
import type { NotFoundData } from "../../src/server/fn";
import { createRecipe, getRecipe } from "../../src/server/recipes";
import { createTimelineEvent, deleteTimelineEvent, listTimeline } from "../../src/server/timeline";
import { callServerFn, useTempDataDir } from "../helpers/server";

useTempDataDir();

const missing = "99999999-9999-4999-8999-999999999999";

const doc = (name = "Flatbread"): RecipeInput =>
  ({ name, components: [{ name: "", ingredients: [], steps: [{ text: "Mix." }] }] }) as RecipeInput;

async function seed(name?: string) {
  return callServerFn(createRecipe, doc(name));
}

async function notFoundData(promise: Promise<unknown>): Promise<NotFoundData> {
  const caught = await promise.catch((e: unknown) => e);
  expect(isNotFound(caught)).toBe(true);
  return (caught as { data: NotFoundData }).data;
}

test("createTimelineEvent stores the cook and returns it", async () => {
  const recipe = await seed();
  const event = await callServerFn(createTimelineEvent, {
    recipeId: recipe.id,
    event: { occurredOn: "2026-09-11", message: "Crispier at 220.", image: null },
  });
  expect(timelineEventSchema.safeParse(event).success).toBe(true);
  expect(event.recipeId).toBe(recipe.id);
  expect(event.occurredOn).toBe("2026-09-11");
  expect(event.message).toBe("Crispier at 220.");
  expect(event.image).toBeNull();
});

test("createTimelineEvent moves the recipe's last made date to the latest cook", async () => {
  const recipe = await seed();
  await callServerFn(createTimelineEvent, { recipeId: recipe.id, event: { occurredOn: "2026-03-04", message: "", image: null } });
  await callServerFn(createTimelineEvent, { recipeId: recipe.id, event: { occurredOn: "2026-09-11", message: "", image: null } });
  const after = await callServerFn(getRecipe, { slug: recipe.slug });
  expect(after.lastMade).toBe("2026-09-11T00:00:00.000Z");
});

test("listTimeline returns a recipe's cooks newest first, and only that recipe's", async () => {
  const tart = await seed("Lemon tart");
  const bread = await seed("Flatbread");
  await callServerFn(createTimelineEvent, { recipeId: tart.id, event: { occurredOn: "2026-03-04", message: "First go", image: null } });
  await callServerFn(createTimelineEvent, { recipeId: tart.id, event: { occurredOn: "2026-09-11", message: "Better", image: null } });
  await callServerFn(createTimelineEvent, { recipeId: bread.id, event: { occurredOn: "2026-05-05", message: "Other recipe", image: null } });

  const events = await callServerFn(listTimeline, { recipeId: tart.id });
  expect(events.map((event) => event.occurredOn)).toEqual(["2026-09-11", "2026-03-04"]);
  expect(events.every((event) => event.recipeId === tart.id)).toBe(true);
});

test("listTimeline is empty for a recipe that has never been cooked", async () => {
  const recipe = await seed();
  expect(await callServerFn(listTimeline, { recipeId: recipe.id })).toEqual([]);
});

test("deleteTimelineEvent removes the entry and falls last made back", async () => {
  const recipe = await seed();
  await callServerFn(createTimelineEvent, { recipeId: recipe.id, event: { occurredOn: "2026-03-04", message: "", image: null } });
  const latest = await callServerFn(createTimelineEvent, { recipeId: recipe.id, event: { occurredOn: "2026-09-11", message: "", image: null } });

  expect(await callServerFn(deleteTimelineEvent, { id: latest.id })).toEqual({ id: latest.id });
  expect((await callServerFn(listTimeline, { recipeId: recipe.id })).map((event) => event.occurredOn)).toEqual(["2026-03-04"]);
  expect((await callServerFn(getRecipe, { slug: recipe.slug })).lastMade).toBe("2026-03-04T00:00:00.000Z");
});

test("createTimelineEvent on an unknown recipe is a not-found", async () => {
  const data = await notFoundData(callServerFn(createTimelineEvent, { recipeId: missing, event: { occurredOn: "2026-09-11", message: "", image: null } }));
  expect(data.entity).toBe("recipe");
  expect(data.id).toBe(missing);
});

test("deleteTimelineEvent on an unknown entry is a not-found", async () => {
  const data = await notFoundData(callServerFn(deleteTimelineEvent, { id: missing }));
  expect(data.entity).toBe("timeline event");
});

test("a date that is not YYYY-MM-DD is rejected before the handler runs", async () => {
  const recipe = await seed();
  await expect(callServerFn(createTimelineEvent, { recipeId: recipe.id, event: { occurredOn: "11/09/2026", message: "", image: null } } as never)).rejects.toThrow();
});

test("a non-uuid recipe id is rejected before the handler runs", async () => {
  await expect(callServerFn(listTimeline, { recipeId: "not-a-uuid" })).rejects.toThrow();
});
