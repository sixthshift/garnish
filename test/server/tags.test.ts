import { isNotFound } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { recipeInputSchema } from "../../src/domain/recipe";
import { createRecipe } from "../../src/server/recipes";
import type { NotFoundData } from "../../src/server/fn";
import { createTag, deleteTag, findOrCreateTag, listTags, mergeTag, updateTag, usingTag } from "../../src/server/tags";
import { callServerFn, useTempDataDir } from "../helpers/server";

useTempDataDir();

const MISSING = "00000000-0000-4000-8000-000000000000";

test("create derives the slug; list is by name and filters on q", async () => {
  const dinner = await callServerFn(createTag, { name: " Weeknight Dinner " });
  expect(dinner).toMatchObject({ name: "Weeknight Dinner", slug: "weeknight-dinner" });
  await callServerFn(createTag, { name: "Dinner" });
  await callServerFn(createTag, { name: "Dessert" });

  expect((await callServerFn(listTags, {})).map((t) => t.name)).toEqual(["Dessert", "Dinner", "Weeknight Dinner"]);
  expect((await callServerFn(listTags, { q: "DINNER" })).map((t) => t.name)).toEqual(["Dinner", "Weeknight Dinner"]);
  expect(await callServerFn(listTags, { q: "lunch" })).toEqual([]);
});

test("update renames and the slug follows", async () => {
  const tag = await callServerFn(createTag, { name: "Quick" });
  expect(await callServerFn(updateTag, { id: tag.id, name: "Quick & Easy" })).toEqual({ id: tag.id, name: "Quick & Easy", slug: "quick-easy" });
  expect(await callServerFn(updateTag, { id: tag.id })).toEqual({ id: tag.id, name: "Quick & Easy", slug: "quick-easy" });
});

test("update and delete of an unknown id are not-found errors", async () => {
  const caught = await callServerFn(updateTag, { id: MISSING, name: "x" }).catch((e: unknown) => e);
  expect(isNotFound(caught)).toBe(true);
  expect((caught as { data: NotFoundData }).data).toMatchObject({ entity: "tag", id: MISSING });
  const gone = await callServerFn(deleteTag, { id: MISSING }).catch((e: unknown) => e);
  expect(isNotFound(gone)).toBe(true);
});

test("delete returns the removed row and the list no longer has it", async () => {
  const tag = await callServerFn(createTag, { name: "Soup" });
  expect(await callServerFn(deleteTag, { id: tag.id })).toEqual(tag);
  expect(await callServerFn(listTags, {})).toEqual([]);
});

test("findOrCreate returns the case-insensitive match, else a new row", async () => {
  const vegan = await callServerFn(createTag, { name: "Vegan" });
  expect(await callServerFn(findOrCreateTag, { name: " VEGAN " })).toEqual(vegan);
  expect(await callServerFn(findOrCreateTag, { name: "Baking" })).toMatchObject({ name: "Baking", slug: "baking" });
  expect(await callServerFn(listTags, {})).toHaveLength(2);
});

test("validation rejects a blank name and a missing id", async () => {
  await expect(callServerFn(createTag, { name: "" })).rejects.toThrow(/too_small|at least 1/);
  await expect(callServerFn(updateTag, { name: "x" } as never)).rejects.toThrow(/expected string/);
  await expect(callServerFn(deleteTag, { id: 3 } as never)).rejects.toThrow(/expected string/);
});

test("usingTag lists the recipes carrying that tag", async () => {
  const weeknight = await callServerFn(createTag, { name: "Weeknight" });
  await callServerFn(createRecipe, recipeInputSchema.parse({ name: "Toast", parts: [{ name: "", ingredients: [], steps: [] }], tags: [weeknight] }));
  expect((await callServerFn(usingTag, { id: weeknight.id })).map((r) => r.name)).toEqual(["Toast"]);

  const baking = await callServerFn(createTag, { name: "Baking" });
  expect(await callServerFn(usingTag, { id: baking.id })).toEqual([]);
});

test("mergeTag repoints recipes to the target tag, deletes the source, and drops it from the list", async () => {
  const weeknight = await callServerFn(createTag, { name: "Weeknight" });
  const quick = await callServerFn(createTag, { name: "Quick" });
  await callServerFn(
    createRecipe,
    recipeInputSchema.parse({ name: "Shortbread", parts: [{ name: "", ingredients: [], steps: [] }], tags: [quick] }),
  );

  const merged = await callServerFn(mergeTag, { sourceId: quick.id, targetId: weeknight.id });
  expect(merged).toEqual(weeknight);
  expect((await callServerFn(listTags, { q: "quick" })).map((t) => t.name)).toEqual([]);
  expect((await callServerFn(usingTag, { id: weeknight.id })).map((r) => r.name)).toEqual(["Shortbread"]);
});

test("mergeTag is not-found when either id is unknown", async () => {
  const weeknight = await callServerFn(createTag, { name: "Weeknight" });
  const missingSource = await callServerFn(mergeTag, { sourceId: MISSING, targetId: weeknight.id }).catch((e: unknown) => e);
  expect(isNotFound(missingSource)).toBe(true);
  expect((missingSource as { data: NotFoundData }).data).toMatchObject({ entity: "tag", id: MISSING });

  const missingTarget = await callServerFn(mergeTag, { sourceId: weeknight.id, targetId: MISSING }).catch((e: unknown) => e);
  expect(isNotFound(missingTarget)).toBe(true);
  expect((missingTarget as { data: NotFoundData }).data).toMatchObject({ entity: "tag", id: MISSING });
});
