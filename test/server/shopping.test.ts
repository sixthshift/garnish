// Shopping list server functions against a temp DATA_DIR: one test per
// function, the validation each rejects, and not-found for the writes that
// name a line by id.
import { isNotFound } from "@tanstack/react-router";
import { expect, test } from "vitest";
import type { RecipeInput } from "../../src/domain/recipe";
import { shoppingItemSchema } from "../../src/domain/shopping";
import type { NotFoundData } from "../../src/server/fn";
import { createAisle } from "../../src/server/aisles";
import { createFood } from "../../src/server/foods";
import { createRecipe, deleteRecipe } from "../../src/server/recipes";
import {
  addShoppingItems,
  clearTickedShoppingItems,
  listShoppingItems,
  mergeShoppingItems,
  removeShoppingItem,
  reorderShoppingItems,
  tickShoppingItem,
  updateShoppingItem,
} from "../../src/server/shopping";
import { findOrCreateUnit } from "../../src/server/units";
import { callServerFn, useTempDataDir } from "../helpers/server";

useTempDataDir();

const MISSING = "00000000-0000-4000-8000-000000000000";

const text = (t: string) => ({ text: t });

async function notFoundData(promise: Promise<unknown>): Promise<NotFoundData> {
  const caught = await promise.catch((e: unknown) => e);
  expect(isNotFound(caught)).toBe(true);
  return (caught as { data: NotFoundData }).data;
}

test("the list starts empty and addShoppingItems appends to it", async () => {
  expect(await callServerFn(listShoppingItems)).toEqual([]);

  const added = await callServerFn(addShoppingItems, { items: [text("Milk"), text("Bread")] });
  expect(added.map((i) => i.text)).toEqual(["Milk", "Bread"]);
  expect(added.every((i) => shoppingItemSchema.safeParse(i).success)).toBe(true);

  const list = await callServerFn(listShoppingItems);
  expect(list.map((i) => [i.text, i.position])).toEqual([
    ["Milk", 0],
    ["Bread", 1],
  ]);
});

test("addShoppingItems stores a food line with its unit, aisle and source", async () => {
  const aisle = await callServerFn(createAisle, { name: "Baking" });
  const food = await callServerFn(createFood, { name: "Plain flour", aisleId: aisle.id });
  const unit = await callServerFn(findOrCreateUnit, { name: "gram" });
  const recipe = await callServerFn(createRecipe, {
    name: "Lemon tart",
    parts: [{ name: "", ingredients: [], steps: [] }],
  } as RecipeInput);

  const [item] = await callServerFn(addShoppingItems, {
    items: [
      {
        quantity: 250,
        foodId: food.id,
        unitId: unit.id,
        sources: [{ recipeId: recipe.id, recipeName: "Lemon tart", partName: "Pastry", servings: 4, quantity: 250 }],
      },
    ],
  });

  expect(item!.food?.name).toBe("Plain flour");
  expect(item!.food?.aisle?.name).toBe("Baking");
  expect(item!.unit?.id).toBe(unit.id);
  expect(item!.sources[0]).toMatchObject({ recipeId: recipe.id, recipeName: "Lemon tart", partName: "Pastry" });
});

test("a line's source outlives the recipe it came from", async () => {
  const recipe = await callServerFn(createRecipe, {
    name: "Lemon tart",
    parts: [{ name: "", ingredients: [], steps: [] }],
  } as RecipeInput);
  await callServerFn(addShoppingItems, {
    items: [{ text: "Butter", sources: [{ recipeId: recipe.id, recipeName: "Lemon tart", partName: "Pastry" }] }],
  });

  await callServerFn(deleteRecipe, { id: recipe.id });

  const [item] = await callServerFn(listShoppingItems);
  expect(item!.sources[0]).toMatchObject({ recipeId: null, recipeName: "Lemon tart", partName: "Pastry" });
});

test("addShoppingItems rejects a line with neither a food nor text", async () => {
  await expect(callServerFn(addShoppingItems, { items: [{ quantity: 2 }] })).rejects.toThrow();
  expect(await callServerFn(listShoppingItems)).toEqual([]);
});

test("updateShoppingItem merges a patch and misses on an unknown id", async () => {
  const [milk] = await callServerFn(addShoppingItems, { items: [text("Milk")] });
  const updated = await callServerFn(updateShoppingItem, { id: milk!.id, quantity: 2, text: "Milk, full cream" });
  expect(updated).toMatchObject({ id: milk!.id, quantity: 2, text: "Milk, full cream", ticked: false });

  expect(await notFoundData(callServerFn(updateShoppingItem, { id: MISSING, text: "x" }))).toMatchObject({
    entity: "shopping item",
    id: MISSING,
  });
});

test("tickShoppingItem ticks and unticks, and misses on an unknown id", async () => {
  const [milk] = await callServerFn(addShoppingItems, { items: [text("Milk")] });
  expect((await callServerFn(tickShoppingItem, { id: milk!.id, ticked: true })).ticked).toBe(true);
  expect((await callServerFn(tickShoppingItem, { id: milk!.id, ticked: false })).ticked).toBe(false);
  expect(await notFoundData(callServerFn(tickShoppingItem, { id: MISSING, ticked: true }))).toMatchObject({
    entity: "shopping item",
  });
});

test("removeShoppingItem deletes one line and misses on an unknown id", async () => {
  const [milk, bread] = await callServerFn(addShoppingItems, { items: [text("Milk"), text("Bread")] });
  expect(await callServerFn(removeShoppingItem, { id: milk!.id })).toEqual({ id: milk!.id });
  expect((await callServerFn(listShoppingItems)).map((i) => i.id)).toEqual([bread!.id]);
  await notFoundData(callServerFn(removeShoppingItem, { id: milk!.id }));
});

test("clearTickedShoppingItems removes only the ticked lines", async () => {
  const [milk, bread, eggs] = await callServerFn(addShoppingItems, {
    items: [text("Milk"), text("Bread"), text("Eggs")],
  });
  await callServerFn(tickShoppingItem, { id: milk!.id, ticked: true });
  await callServerFn(tickShoppingItem, { id: eggs!.id, ticked: true });

  expect(await callServerFn(clearTickedShoppingItems)).toEqual({ removed: 2 });
  expect((await callServerFn(listShoppingItems)).map((i) => i.id)).toEqual([bread!.id]);
  expect(await callServerFn(clearTickedShoppingItems)).toEqual({ removed: 0 });
});

test("reorderShoppingItems writes the sent order and returns the list", async () => {
  const [milk, bread, eggs] = await callServerFn(addShoppingItems, {
    items: [text("Milk"), text("Bread"), text("Eggs")],
  });
  const after = await callServerFn(reorderShoppingItems, { ids: [eggs!.id, bread!.id, milk!.id] });
  expect(after.map((i) => i.text)).toEqual(["Eggs", "Bread", "Milk"]);
  expect((await callServerFn(listShoppingItems)).map((i) => i.text)).toEqual(["Eggs", "Bread", "Milk"]);
});

test("mergeShoppingItems tops a line up and appends the sources behind it", async () => {
  const food = await callServerFn(createFood, { name: "Plain flour" });
  const unit = await callServerFn(findOrCreateUnit, { name: "gram" });
  const [flour] = await callServerFn(addShoppingItems, {
    items: [
      {
        quantity: 100,
        foodId: food.id,
        unitId: unit.id,
        sources: [{ recipeName: "Scones", partName: "", servings: 4, quantity: 100 }],
      },
    ],
  });

  const [merged] = await callServerFn(mergeShoppingItems, {
    merges: [{ id: flour!.id, quantity: 300, sources: [{ recipeName: "Lemon tart", partName: "Pastry", servings: 8, quantity: 200 }] }],
  });

  expect(merged).toMatchObject({ id: flour!.id, quantity: 300 });
  expect(merged!.sources.map((s) => [s.recipeName, s.quantity])).toEqual([
    ["Scones", 100],
    ["Lemon tart", 200],
  ]);
  expect((await callServerFn(listShoppingItems)).length).toBe(1);
});

test("mergeShoppingItems misses on an unknown id", async () => {
  expect(await notFoundData(callServerFn(mergeShoppingItems, { merges: [{ id: MISSING, quantity: 1, sources: [] }] }))).toMatchObject({
    entity: "shopping item",
    id: MISSING,
  });
});
