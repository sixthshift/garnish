import { isNotFound } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { createAisle } from "../../../src/api/rpc/aisles";
import { createFood, deleteFood, foodForRecipe, listFoods, mergeFood, updateFood, usingFood } from "../../../src/api/rpc/foods";
import { createRecipe } from "../../../src/api/rpc/recipes";
import unitRepo from "../../../src/db/models/unit/repo";
import { recipeInputSchema } from "../../../src/domain/recipes/recipe";
import type { NotFoundData } from "../../../src/server/core/fn";
import { callServerFn, useTempDataDir } from "../../helpers/server";

useTempDataDir();

const MISSING = "00000000-0000-4000-8000-000000000000";

test("create applies defaults; list is by name and filters on q", async () => {
  const butter = await callServerFn(createFood, { name: " Butter " });
  expect(butter).toMatchObject({ name: "Butter", pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false });
  await callServerFn(createFood, { name: "peanut butter", aliases: ["pb"], skipShopping: true });
  await callServerFn(createFood, { name: "salt" });

  expect((await callServerFn(listFoods, {})).map((f) => f.name)).toEqual(["Butter", "peanut butter", "salt"]);
  expect((await callServerFn(listFoods, { q: "BUTT" })).map((f) => f.name)).toEqual(["Butter", "peanut butter"]);
  expect(await callServerFn(listFoods, { q: "nothing" })).toEqual([]);
});

test("update merges a patch and keeps untouched fields", async () => {
  const dairy = await callServerFn(createAisle, { name: "Dairy" });
  const food = await callServerFn(createFood, { name: "milk", pluralName: "milks" });
  const updated = await callServerFn(updateFood, { id: food.id, aisleId: dairy.id, skipShopping: true });
  expect(updated).toEqual({ ...food, aisleId: dairy.id, skipShopping: true });
  expect(await callServerFn(updateFood, { id: food.id, name: "Full cream milk" })).toMatchObject({ name: "Full cream milk", pluralName: "milks" });
});

test("update and delete of an unknown id are not-found errors", async () => {
  const caught = await callServerFn(updateFood, { id: MISSING, name: "x" }).catch((e: unknown) => e);
  expect(isNotFound(caught)).toBe(true);
  expect((caught as { data: NotFoundData }).data).toMatchObject({ entity: "food", id: MISSING });
  const gone = await callServerFn(deleteFood, { id: MISSING }).catch((e: unknown) => e);
  expect(isNotFound(gone)).toBe(true);
});

test("delete returns the removed row and the list no longer has it", async () => {
  const food = await callServerFn(createFood, { name: "sugar" });
  expect(await callServerFn(deleteFood, { id: food.id })).toEqual(food);
  expect(await callServerFn(listFoods, {})).toEqual([]);
});

test("validation rejects a blank name and wrong types before the handler", async () => {
  await expect(callServerFn(createFood, { name: "   " })).rejects.toThrow(/too_small|at least 1/);
  await expect(callServerFn(createFood, { name: "x", aliases: "pb" } as never)).rejects.toThrow(/expected array/);
});

test("usingFood lists the recipes with an ingredient of that food", async () => {
  const butter = await callServerFn(createFood, { name: "butter" });
  await callServerFn(createRecipe, recipeInputSchema.parse({ name: "Toast", parts: [{ name: "", ingredients: [{ food: butter }], steps: [] }] }));
  expect((await callServerFn(usingFood, { id: butter.id })).map((r) => r.name)).toEqual(["Toast"]);

  const salt = await callServerFn(createFood, { name: "salt" });
  expect(await callServerFn(usingFood, { id: salt.id })).toEqual([]);
});

test("mergeFood repoints ingredients to the target, deletes the source, and drops it from the list", async () => {
  const butter = await callServerFn(createFood, { name: "butter" });
  const unsalted = await callServerFn(createFood, { name: "unsalted butter" });
  await callServerFn(createRecipe, recipeInputSchema.parse({ name: "Shortbread", parts: [{ name: "", ingredients: [{ food: unsalted }], steps: [] }] }));

  const merged = await callServerFn(mergeFood, { sourceId: unsalted.id, targetId: butter.id });
  expect(merged).toEqual(butter);
  expect((await callServerFn(listFoods, {})).map((f) => f.name)).toEqual(["butter"]);
  expect((await callServerFn(usingFood, { id: butter.id })).map((r) => r.name)).toEqual(["Shortbread"]);
});

test("mergeFood is not-found when either id is unknown", async () => {
  const butter = await callServerFn(createFood, { name: "butter" });
  const missingSource = await callServerFn(mergeFood, { sourceId: MISSING, targetId: butter.id }).catch((e: unknown) => e);
  expect(isNotFound(missingSource)).toBe(true);
  expect((missingSource as { data: NotFoundData }).data).toMatchObject({ entity: "food", id: MISSING });

  const missingTarget = await callServerFn(mergeFood, { sourceId: butter.id, targetId: MISSING }).catch((e: unknown) => e);
  expect(isNotFound(missingTarget)).toBe(true);
  expect((missingTarget as { data: NotFoundData }).data).toMatchObject({ entity: "food", id: MISSING });
});

// --- Conversions (M32.1, decisions.md row 69) --------------------------------

test("updateFood carries conversions beside the other fields, and omitting them keeps them", async () => {
  const cup = unitRepo.findOrCreate("cup");
  const gram = unitRepo.findOrCreate("gram");
  const flour = await callServerFn(createFood, {
    name: "conversion flour",
    conversions: [{ unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 125 }],
  });
  expect(flour.conversions).toHaveLength(1);

  const renamed = await callServerFn(updateFood, { id: flour.id, name: "Conversion flour" });
  expect(renamed.name).toBe("Conversion flour");
  expect(renamed.conversions).toEqual(flour.conversions);

  const changed = await callServerFn(updateFood, { id: flour.id, conversions: [{ unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 120 }] });
  expect(changed.conversions.map((c) => c.toQuantity)).toEqual([120]);
});

test("conversions validation: positive amounts, two different units, and a known food", async () => {
  const cup = unitRepo.findOrCreate("cup");
  const gram = unitRepo.findOrCreate("gram");
  const flour = await callServerFn(createFood, { name: "validation flour" });

  await expect(callServerFn(updateFood, { id: flour.id, conversions: [{ unitId: cup.id, quantity: 0, toUnitId: gram.id, toQuantity: 125 }] })).rejects.toThrow(
    /greater than 0|too_small/
  );
  await expect(callServerFn(updateFood, { id: flour.id, conversions: [{ unitId: cup.id, quantity: 1, toUnitId: cup.id, toQuantity: 1 }] })).rejects.toThrow(
    /two different units/
  );

  const missing = await callServerFn(updateFood, { id: MISSING, conversions: [] }).catch((e: unknown) => e);
  expect(isNotFound(missing)).toBe(true);
});

test("foodForRecipe creates a food of the recipe's name linked back to it, and is idempotent", async () => {
  const recipe = await callServerFn(createRecipe, recipeInputSchema.parse({ name: "Sweet pastry", parts: [{ name: "" }] }));
  const food = await callServerFn(foodForRecipe, { recipeId: recipe.id });
  expect(food).toMatchObject({ name: "Sweet pastry", recipeId: recipe.id });

  // Again: the same food, not a second one.
  expect(await callServerFn(foodForRecipe, { recipeId: recipe.id })).toEqual(food);
  expect((await callServerFn(listFoods, { q: "Sweet pastry" })).length).toBe(1);
});

test("foodForRecipe links an existing food of that name rather than creating another", async () => {
  const recipe = await callServerFn(createRecipe, recipeInputSchema.parse({ name: "Hollandaise", parts: [{ name: "" }] }));
  const existing = await callServerFn(createFood, { name: "hollandaise" });
  const linked = await callServerFn(foodForRecipe, { recipeId: recipe.id });
  expect(linked.id).toBe(existing.id);
  expect(linked.recipeId).toBe(recipe.id);
});

test("foodForRecipe on an unknown recipe is a not-found error", async () => {
  const caught = await callServerFn(foodForRecipe, { recipeId: MISSING }).catch((e: unknown) => e);
  expect(isNotFound(caught)).toBe(true);
  expect((caught as { data: NotFoundData }).data).toMatchObject({ entity: "recipe", id: MISSING });
});
