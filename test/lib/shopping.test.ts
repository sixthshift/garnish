// One "Add to shopping list" tap (M31.3), driven through a fake writer: what
// the sheet's Add actually sends, and what the toast counts.
import { describe, expect, test } from "vitest";
import { additionsFor } from "../../src/components/AddToShoppingSheet";
import type { Food, Part, Recipe, Unit } from "../../src/domain/recipe";
import { scaledForServings } from "../../src/domain/scale";
import type { ShoppingItem, ShoppingItemInput, ShoppingListMerge } from "../../src/domain/shopping";
import { addToShoppingList, addedCount, addedMessage, type ShoppingWriter } from "../../src/lib/shopping";

const food = (name: string): Food => ({ id: `food-${name}`, name, pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false });

const gram: Unit = { id: "unit-g", name: "gram", pluralName: "grams", abbreviation: "g", useAbbreviation: true, fraction: false, standardQuantity: null, standardUnitId: null };

const part = (name: string, ingredients: Part["ingredients"]): Part => ({ id: `part-${name || "main"}`, name, ingredients, steps: [] });

const FLOUR = { id: "ing-flour", quantity: 200, unit: gram, food: food("flour"), note: "", originalText: "", fixed: false };
const LEMON = { id: "ing-lemon", quantity: 2, unit: null, food: food("lemon"), note: "", originalText: "", fixed: false };

/** A 4-serving tart: 200 g flour in the pastry, 2 lemons in the filling. */
const tart: Recipe = {
  id: "recipe-tart",
  slug: "lemon-tart",
  name: "Lemon tart",
  description: "",
  image: null,
  rating: null,
  lastMade: null,
  recipeServings: 4,
  recipeYieldQuantity: 0,
  yieldUnit: null,
  recipeYield: "",
  prepTime: null,
  performTime: null,
  sourceUrl: null,
  favourite: false,
  notes: [],
  tags: [],
  parts: [part("Pastry", [FLOUR]), part("Filling", [LEMON])],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function fakeWriter(items: ShoppingItem[] = []) {
  const sent = { added: [] as ShoppingItemInput[], merged: [] as ShoppingListMerge[], lists: 0 };
  const writer: ShoppingWriter = {
    list: async () => {
      sent.lists += 1;
      return items;
    },
    add: async (additions) => void sent.added.push(...additions),
    merge: async (merges) => void sent.merged.push(...merges),
  };
  return { writer, sent };
}

/** An unticked line already on the list, for the merge case. */
function existingFlour(quantity: number): ShoppingItem {
  return {
    id: "item-flour",
    position: 0,
    quantity,
    unit: gram,
    food: food("flour"),
    text: "",
    ticked: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sources: [],
  };
}

describe("addedMessage", () => {
  test.each([
    [1, "1 item added"],
    [3, "3 items added"],
    [0, "0 items added"],
  ])("%i -> %s", (count, expected) => {
    expect(addedMessage(count)).toBe(expected);
  });
});

describe("addedCount", () => {
  test("counts the lines created plus the lines topped up", () => {
    expect(addedCount({ merges: [{ id: "a", quantity: 1, sources: [] }], additions: [{ text: "Milk" }, { text: "Bread" }] })).toBe(3);
  });
});

describe("addToShoppingList", () => {
  test("sends only the included rows, at the scaled quantities, with the recipe as source", async () => {
    // The page is showing 8 servings of a 4-serving recipe, and the lemons
    // have been tapped off in the sheet.
    const shown = scaledForServings(tart, 8);
    const additions = additionsFor(shown, new Set([LEMON.id]));
    const { writer, sent } = fakeWriter();

    expect(await addToShoppingList(additions, writer)).toBe(1);
    expect(sent.lists).toBe(1);
    expect(sent.merged).toEqual([]);
    expect(sent.added).toHaveLength(1);

    const line = sent.added[0]!;
    expect(line.foodId).toBe("food-flour");
    expect(line.unitId).toBe("unit-g");
    expect(line.quantity).toBe(400); // 200 g at 4 servings, doubled
    expect(line.sources).toEqual([
      { recipeId: "recipe-tart", recipeName: "Lemon tart", partName: "Pastry", servings: 8, quantity: 400 },
    ]);
  });

  test("an addition matching an unticked line tops that line up instead of adding one", async () => {
    const { writer, sent } = fakeWriter([existingFlour(100)]);

    expect(await addToShoppingList(additionsFor(tart), writer)).toBe(2);
    expect(sent.merged).toEqual([
      {
        id: "item-flour",
        quantity: 300,
        sources: [{ recipeId: "recipe-tart", recipeName: "Lemon tart", partName: "Pastry", servings: 4, quantity: 200 }],
      },
    ]);
    expect(sent.added.map((line) => line.foodId)).toEqual(["food-lemon"]);
  });

  test("an empty batch writes nothing at all", async () => {
    const { writer, sent } = fakeWriter();
    expect(await addToShoppingList([], writer)).toBe(0);
    expect(sent).toEqual({ added: [], merged: [], lists: 0 });
  });
});
