// The shopping list document: defaults, the one rule a line must satisfy, and
// the patch's "absent means leave alone".
import { describe, expect, test } from "vitest";
import { type Ingredient, mergeIngredients, type Recipe, recipeSchema, type SubRecipe, scaleRecipe } from "../../../src/domain/recipe";
import { groupByAisle, shoppingItemLabel, sourceLabel, TICKED_GROUP, UNASSIGNED_GROUP } from "../../../src/domain/shopping/groups";
import { mergeIntoList, type ShoppingAddition, type ShoppingAdditionSource } from "../../../src/domain/shopping/merge";
import {
  type ShoppingItem,
  shoppingItemInputSchema,
  shoppingItemPatchSchema,
  shoppingItemSchema,
  shoppingItemSourceSchema,
} from "../../../src/domain/shopping/schema";
import { subRecipeAdditions } from "../../../src/domain/shopping/subRecipe";

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
  expect(shoppingItemSchema.safeParse({ id, position: -1, text: "Milk", createdAt: stamp, updatedAt: stamp }).success).toBe(false);
  expect(shoppingItemSchema.safeParse({ position: 0, text: "Milk", createdAt: stamp, updatedAt: stamp }).success).toBe(false);
});

test("an empty patch is valid and names nothing", () => {
  expect(shoppingItemPatchSchema.parse({})).toEqual({});
  expect(shoppingItemPatchSchema.parse({ ticked: true })).toEqual({ ticked: true });
  expect(shoppingItemPatchSchema.parse({ foodId: null })).toEqual({ foodId: null });
  expect(shoppingItemPatchSchema.safeParse({ ticked: "yes" }).success).toBe(false);
});

// --- mergeIntoList -----------------------------------------------------------

const gram = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  standardQuantity: null,
  standardUnitId: null,
};

const cup = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "cup",
  pluralName: "cups",
  abbreviation: "cup",
  useAbbreviation: false,
  fraction: true,
  standardQuantity: null,
  standardUnitId: null,
};

const flour = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  name: "flour",
  pluralName: null,
  aliases: [],
  aisle: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};
const butter = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  name: "butter",
  pluralName: null,
  aliases: [],
  aisle: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};
const garlic = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "garlic",
  pluralName: null,
  aliases: [],
  aisle: null,
  recipeId: null,
  skipShopping: true,
  conversions: [],
};
const bayLeaf = {
  id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  name: "bay leaf",
  pluralName: "bay leaves",
  aliases: [],
  aisle: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};

let nextItemId = 0;
function existingItem(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  nextItemId += 1;
  const suffix = String(nextItemId).padStart(12, "0");
  return shoppingItemSchema.parse({
    id: `99999999-9999-4999-8999-${suffix}`,
    position: nextItemId,
    quantity: null,
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  });
}

function addition(overrides: Partial<ShoppingAddition> = {}): ShoppingAddition {
  return {
    quantity: null,
    unit: null,
    food: null,
    originalText: "",
    fixed: false,
    source: { recipeId: null, recipeName: "Lemon tart", partName: "", servings: 4 },
    ...overrides,
  };
}

describe("mergeIntoList", () => {
  test("an addition with the same food and unit as an unticked item adds its quantity and appends its source", () => {
    const existing = existingItem({ quantity: 200, unit: gram, food: flour });
    const plan = mergeIntoList([existing], [addition({ quantity: 50, unit: gram, food: flour })]);

    expect(plan.additions).toEqual([]);
    expect(plan.merges).toHaveLength(1);
    expect(plan.merges[0]).toMatchObject({
      id: existing.id,
      quantity: 250,
      sources: [{ recipeName: "Lemon tart", quantity: 50 }],
    });
  });

  test("a ticked item is left alone and a new line is made", () => {
    const ticked = existingItem({ quantity: 200, unit: gram, food: flour, ticked: true });
    const plan = mergeIntoList([ticked], [addition({ quantity: 50, unit: gram, food: flour })]);

    expect(plan.merges).toEqual([]);
    expect(plan.additions).toHaveLength(1);
    expect(plan.additions[0]).toMatchObject({ foodId: flour.id, unitId: gram.id, quantity: 50 });
  });

  test("a free-text addition never merges, even with an identical existing free-text line", () => {
    const existing = existingItem({ text: "Batteries" });
    const plan = mergeIntoList([existing], [addition({ originalText: "Batteries" })]);

    expect(plan.merges).toEqual([]);
    expect(plan.additions).toHaveLength(1);
    expect(plan.additions[0]).toMatchObject({ foodId: null, text: "Batteries" });
  });

  test("a skipShopping food is dropped", () => {
    const plan = mergeIntoList([], [addition({ quantity: 2, food: garlic })]);

    expect(plan.merges).toEqual([]);
    expect(plan.additions).toEqual([]);
  });

  test("a text-only ingredient (no food) becomes a free-text line with its originalText", () => {
    const plan = mergeIntoList([], [addition({ quantity: 1, originalText: "a pinch of this and that" })]);

    expect(plan.additions).toEqual([
      {
        quantity: null,
        unitId: null,
        foodId: null,
        text: "a pinch of this and that",
        ticked: false,
        sources: [{ recipeId: null, recipeName: "Lemon tart", partName: "", servings: 4, quantity: null }],
      },
    ]);
  });

  test("a fixed or null-quantity food addition never merges, even with a matching food and unit", () => {
    const existing = existingItem({ quantity: 1, unit: cup, food: bayLeaf });
    const plan = mergeIntoList([existing], [addition({ quantity: 1, unit: cup, food: bayLeaf, fixed: true }), addition({ quantity: null, food: flour })]);

    expect(plan.merges).toEqual([]);
    expect(plan.additions).toHaveLength(2);
    expect(plan.additions[0]).toMatchObject({ foodId: bayLeaf.id, quantity: 1 });
    expect(plan.additions[1]).toMatchObject({ foodId: flour.id, quantity: null });
  });

  test("two additions with the same food and unit and no existing line merge into one new line", () => {
    const plan = mergeIntoList(
      [],
      [
        addition({ quantity: 200, unit: gram, food: flour }),
        addition({ quantity: 50, unit: gram, food: flour, source: { recipeId: null, recipeName: "Scones", partName: "", servings: 8 } }),
      ]
    );

    expect(plan.additions).toHaveLength(1);
    expect(plan.additions[0]).toMatchObject({ foodId: flour.id, unitId: gram.id, quantity: 250 });
    expect(plan.additions[0]!.sources).toEqual([
      { recipeId: null, recipeName: "Lemon tart", partName: "", servings: 4, quantity: 200 },
      { recipeId: null, recipeName: "Scones", partName: "", servings: 8, quantity: 50 },
    ]);
  });

  test("a cup and 300 g of flour merge into one line in the metric unit (M32.2)", () => {
    const convertibleFlour = {
      ...flour,
      conversions: [{ id: "aaaaaaaa-1111-4111-8111-111111111111", unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 125 }],
    };
    const plan = mergeIntoList(
      [],
      [
        addition({ quantity: 1, unit: cup, food: convertibleFlour }),
        addition({ quantity: 300, unit: gram, food: convertibleFlour, source: { recipeId: null, recipeName: "Scones", partName: "", servings: 8 } }),
      ]
    );

    expect(plan.additions).toHaveLength(1);
    // 1 cup -> 125 g, plus the 300 g addition: 425 g, in the metric unit.
    expect(plan.additions[0]).toMatchObject({ foodId: convertibleFlour.id, unitId: gram.id, quantity: 425 });
  });

  test("an addition merges into an existing persisted line's unit even when the addition's unit differs but converts", () => {
    const convertibleFlour = {
      ...flour,
      conversions: [{ id: "aaaaaaaa-2222-4222-8222-222222222222", unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 125 }],
    };
    const existing = existingItem({ quantity: 100, unit: gram, food: convertibleFlour });
    const plan = mergeIntoList([existing], [addition({ quantity: 1, unit: cup, food: convertibleFlour })]);

    expect(plan.additions).toEqual([]);
    expect(plan.merges).toHaveLength(1);
    // The stored line stays in grams (a merge can't change a persisted unit): 100 + 125.
    expect(plan.merges[0]).toMatchObject({ id: existing.id, quantity: 225 });
  });

  test("a whole recipe at scale 2: merges an overlapping food into the list, drops skipShopping, keeps fixed apart", () => {
    const recipe = recipeSchema.parse({
      id: "10000000-0000-4000-8000-000000000000",
      slug: "buttered-toast",
      name: "Buttered toast",
      recipeServings: 4,
      parts: [
        {
          id: "20000000-0000-4000-8000-000000000000",
          name: "",
          ingredients: [
            { id: "30000000-0000-4000-8000-000000000000", quantity: 100, unit: gram, food: flour },
            { id: "40000000-0000-4000-8000-000000000000", quantity: 20, unit: gram, food: butter },
            { id: "50000000-0000-4000-8000-000000000000", quantity: 1, unit: null, food: garlic },
            { id: "60000000-0000-4000-8000-000000000000", quantity: 1, unit: cup, food: bayLeaf, fixed: true },
          ],
        },
        {
          id: "70000000-0000-4000-8000-000000000000",
          name: "Topping",
          ingredients: [{ id: "80000000-0000-4000-8000-000000000000", quantity: 50, unit: gram, food: flour }],
        },
      ],
      createdAt: stamp,
      updatedAt: stamp,
    }) as Recipe;

    const scaled = scaleRecipe(recipe, 8); // scale 2x
    const ingredients = mergeIngredients(scaled);

    const additions: ShoppingAddition[] = ingredients.map((ingredient) => ({
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      food: ingredient.food,
      originalText: ingredient.originalText,
      fixed: ingredient.fixed,
      source: { recipeId: recipe.id, recipeName: recipe.name, partName: "", servings: scaled.recipeServings },
    }));

    const existingFlour = existingItem({ quantity: 100, unit: gram, food: flour });
    const plan = mergeIntoList([existingFlour], additions);

    // flour: 100 (part 1, x2) + 50 (topping, x2) = 300 merged by mergeIngredients,
    // on top of the existing 100g line
    expect(plan.merges).toEqual([
      { id: existingFlour.id, quantity: 400, sources: [{ recipeId: recipe.id, recipeName: "Buttered toast", partName: "", servings: 8, quantity: 300 }] },
    ]);

    // butter is new, doubled
    expect(plan.additions).toHaveLength(2); // butter, bay leaf (fixed) — garlic dropped
    expect(plan.additions.find((a) => a.foodId === butter.id)).toMatchObject({ quantity: 40 });
    expect(plan.additions.find((a) => a.foodId === bayLeaf.id)).toMatchObject({ quantity: 1 });
    expect(plan.additions.some((a) => a.foodId === garlic.id)).toBe(false);
  });
});

// --- subRecipeAdditions (M32.5) ----------------------------------------------

const CHILD_ID = "12121212-1212-4212-8212-121212121212";

/** A food made by the child recipe: "2 cups of pastry" links here. */
const pastry = {
  id: "56565656-5656-4565-8565-565656565656",
  name: "pastry",
  pluralName: null,
  aliases: [],
  aisle: null,
  recipeId: CHILD_ID,
  skipShopping: false,
  conversions: [],
};

const sweetPastry: SubRecipe = { id: CHILD_ID, slug: "sweet-pastry", name: "Sweet pastry", recipeServings: 4, recipeYieldQuantity: 500, yieldUnit: gram };

const parentSource: ShoppingAdditionSource = { recipeId: "recipe-tart", recipeName: "Lemon tart", partName: "Pastry", servings: 4 };

/** The parent's row: 250 g of pastry, half of the child's 500 g yield — 2 of its 4 servings. */
function pastryRow(overrides: Partial<Ingredient> = {}): Ingredient {
  return { id: "ing-pastry", quantity: 250, unit: gram, food: pastry, note: "", originalText: "", fixed: false, ...overrides };
}

/** The child recipe already scaled to `recipeServings` (as `getRecipe({ servings })` would return it): flour to buy, salt on hand. */
function childDoc(recipeServings: number): Recipe {
  return recipeSchema.parse({
    id: CHILD_ID,
    slug: "sweet-pastry",
    name: "Sweet pastry",
    recipeServings,
    parts: [
      {
        id: "90000000-0000-4000-8000-000000000000",
        name: "",
        ingredients: [
          { id: "a0000000-0000-4000-8000-000000000000", quantity: 100, unit: gram, food: flour },
          { id: "b0000000-0000-4000-8000-000000000000", quantity: 1, unit: null, food: garlic },
        ],
      },
    ],
    createdAt: stamp,
    updatedAt: stamp,
  }) as Recipe;
}

describe("subRecipeAdditions", () => {
  test("a derivable scale returns the child's rows, scaled, with the child as source", () => {
    // 250 g asks for half the child's 500 g yield: 2 of its 4 servings, so the
    // fetched child document (already at 2 servings) carries 100 g of flour.
    const additions = subRecipeAdditions(pastryRow(), sweetPastry, childDoc(2), parentSource);

    expect(additions).toHaveLength(1); // salt is skipShopping: dropped
    expect(additions[0]).toMatchObject({
      quantity: 100,
      unit: gram,
      food: flour,
      fixed: false,
      source: { recipeId: CHILD_ID, recipeName: "Sweet pastry", partName: "", servings: 2 },
    });
  });

  test("an underivable scale adds the food itself as a line, stamped with the parent", () => {
    // No quantity on the row: nothing to relate to the child's yield.
    const additions = subRecipeAdditions(pastryRow({ quantity: null }), sweetPastry, childDoc(2), parentSource);

    expect(additions).toEqual([{ quantity: null, unit: gram, food: pastry, originalText: expect.any(String), fixed: false, source: parentSource }]);
  });

  test("a child not fetched yet also falls back to the food line, not an empty result", () => {
    const additions = subRecipeAdditions(pastryRow(), sweetPastry, null, parentSource);

    expect(additions).toHaveLength(1);
    expect(additions[0]!.food).toBe(pastry);
    expect(additions[0]!.source).toEqual(parentSource);
  });
});

// --- Reading the list (M31.4) ------------------------------------------------

const produce = { id: "11111111-aaaa-4aaa-8aaa-111111111111", name: "Produce", position: 2 };
const dairy = { id: "22222222-aaaa-4aaa-8aaa-222222222222", name: "Dairy", position: 0 };
const bakery = { id: "33333333-aaaa-4aaa-8aaa-333333333333", name: "Bakery", position: 0 };

const withAisle = (food: typeof flour, aisle: typeof produce) => ({ ...food, aisle });

describe("groupByAisle", () => {
  test("groups by aisle in position order, unassigned last", () => {
    const items = [
      existingItem({ quantity: 500, unit: gram, food: withAisle(flour, produce) }),
      existingItem({ text: "Batteries" }),
      existingItem({ quantity: 250, unit: gram, food: withAisle(butter, dairy) }),
      existingItem({ quantity: 2, food: flour }), // a food with no aisle falls in with the text
    ];
    const groups = groupByAisle(items);
    expect(groups.map((group) => group.name)).toEqual(["Dairy", "Produce", UNASSIGNED_GROUP]);
    expect(groups[2]!.items.map((item) => item.id)).toEqual([items[1]!.id, items[3]!.id]);
    expect(groups[0]!.aisle).toEqual(dairy);
    expect(groups[2]!.aisle).toBeNull();
  });

  test("two aisles at the same position read alphabetically", () => {
    const groups = groupByAisle([existingItem({ food: withAisle(flour, dairy) }), existingItem({ food: withAisle(butter, bakery) })]);
    expect(groups.map((group) => group.name)).toEqual(["Bakery", "Dairy"]);
  });

  test("lines keep the order they arrived in within a group", () => {
    const first = existingItem({ food: withAisle(flour, produce) });
    const second = existingItem({ food: withAisle(butter, produce) });
    expect(groupByAisle([first, second])[0]!.items.map((item) => item.id)).toEqual([first.id, second.id]);
  });

  test("every ticked line sinks into one group at the foot, whatever its aisle", () => {
    const groups = groupByAisle([
      existingItem({ food: withAisle(flour, produce), ticked: true }),
      existingItem({ text: "Batteries" }),
      existingItem({ food: withAisle(butter, dairy), ticked: true }),
    ]);
    expect(groups.map((group) => group.name)).toEqual([UNASSIGNED_GROUP, TICKED_GROUP]);
    const last = groups[1]!;
    expect(last.ticked).toBe(true);
    expect(last.items).toHaveLength(2);
  });

  test("an empty list has no groups, and an empty group is never returned", () => {
    expect(groupByAisle([])).toEqual([]);
    expect(groupByAisle([existingItem({ food: withAisle(flour, produce) })]).map((group) => group.name)).toEqual(["Produce"]);
  });
});

describe("shoppingItemLabel", () => {
  test("a food line reads as amount then food, pluralised", () => {
    expect(shoppingItemLabel(existingItem({ quantity: 500, unit: gram, food: flour }))).toBe("500 g flour");
    expect(shoppingItemLabel(existingItem({ quantity: 2, food: bayLeaf }))).toBe("2 bay leaves");
  });

  test("no quantity drops the amount, and a free-text line is its own text", () => {
    expect(shoppingItemLabel(existingItem({ quantity: null, unit: gram, food: flour }))).toBe("flour");
    expect(shoppingItemLabel(existingItem({ text: "  Batteries  " }))).toBe("Batteries");
  });
});

describe("sourceLabel", () => {
  test("recipe, part and servings", () => {
    expect(sourceLabel({ recipeName: "Lemon tart", partName: "Pastry", servings: 4 })).toBe("Lemon tart, Pastry, serves 4");
  });

  test("the unnamed part and missing servings are dropped", () => {
    expect(sourceLabel({ recipeName: "Lemon tart", partName: "", servings: null })).toBe("Lemon tart");
    expect(sourceLabel({ recipeName: "Lemon tart", partName: "", servings: 0 })).toBe("Lemon tart");
  });

  test("a source with no recipe is a line someone typed", () => {
    expect(sourceLabel({ recipeName: "", partName: "", servings: null })).toBe("Added by hand");
  });
});
