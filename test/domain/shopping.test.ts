// The shopping list document: defaults, the one rule a line must satisfy, and
// the patch's "absent means leave alone".
import { expect, test } from "vitest";
import {
  shoppingItemInputSchema,
  shoppingItemPatchSchema,
  shoppingItemSchema,
  shoppingItemSourceSchema,
} from "../../src/domain/shopping";

const id = "11111111-1111-4111-8111-111111111111";
const stamp = "2026-09-13T00:00:00.000Z";

test("an input line fills in every default around its food", () => {
  expect(shoppingItemInputSchema.parse({ foodId: id })).toEqual({
    quantity: null,
    unitId: null,
    foodId: id,
    text: "",
    ticked: false,
    sources: [],
  });
});

test("a line needs a food or some text", () => {
  expect(shoppingItemInputSchema.safeParse({ text: "Batteries" }).success).toBe(true);
  expect(shoppingItemInputSchema.safeParse({ foodId: id }).success).toBe(true);
  expect(shoppingItemInputSchema.safeParse({}).success).toBe(false);
  expect(shoppingItemInputSchema.safeParse({ text: "   " }).success).toBe(false);
});

test("a negative quantity is rejected on a line and on a source", () => {
  expect(shoppingItemInputSchema.safeParse({ text: "Milk", quantity: -1 }).success).toBe(false);
  expect(shoppingItemSourceSchema.safeParse({ id, quantity: -1 }).success).toBe(false);
});

test("a source defaults to no recipe, no names and no amounts", () => {
  expect(shoppingItemSourceSchema.parse({ id })).toEqual({
    id,
    recipeId: null,
    recipeName: "",
    partName: "",
    servings: null,
    quantity: null,
  });
});

test("a source keeps its copied names with no recipe id, which is what outlives a delete", () => {
  const parsed = shoppingItemSourceSchema.parse({
    id,
    recipeId: null,
    recipeName: "Lemon tart",
    partName: "Pastry",
    servings: 4,
    quantity: 250,
  });
  expect(parsed.recipeId).toBeNull();
  expect(parsed.recipeName).toBe("Lemon tart");
});

test("a stored line parses with its nested food and unit null and no sources", () => {
  const item = shoppingItemSchema.parse({
    id,
    position: 0,
    quantity: null,
    text: "Batteries",
    createdAt: stamp,
    updatedAt: stamp,
  });
  expect(item).toMatchObject({ food: null, unit: null, ticked: false, sources: [] });
});

test("a stored line needs its position, id and timestamps", () => {
  expect(shoppingItemSchema.safeParse({ id, text: "Milk", createdAt: stamp, updatedAt: stamp }).success).toBe(false);
  expect(shoppingItemSchema.safeParse({ id, position: -1, text: "Milk", createdAt: stamp, updatedAt: stamp }).success).toBe(
    false,
  );
  expect(shoppingItemSchema.safeParse({ position: 0, text: "Milk", createdAt: stamp, updatedAt: stamp }).success).toBe(
    false,
  );
});

test("an empty patch is valid and names nothing", () => {
  expect(shoppingItemPatchSchema.parse({})).toEqual({});
  expect(shoppingItemPatchSchema.parse({ ticked: true })).toEqual({ ticked: true });
  expect(shoppingItemPatchSchema.parse({ foodId: null })).toEqual({ foodId: null });
  expect(shoppingItemPatchSchema.safeParse({ ticked: "yes" }).success).toBe(false);
});
