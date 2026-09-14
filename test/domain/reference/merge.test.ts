import { describe, expect, test } from "vitest";
import { mergeIngredients } from "../../../src/domain/reference/merge";
import type { Ingredient, Part } from "../../../src/domain/recipe/recipe";

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

const flour = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "flour", pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false, conversions: [] };
const vanilla = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "vanilla pod", pluralName: "vanilla pods", aliases: [], aisle: null, recipeId: null, skipShopping: false, conversions: [] };
const salt = { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", name: "salt", pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false, conversions: [] };

let nextId = 0;
function ingredient(overrides: Partial<Ingredient> = {}): Ingredient {
  nextId += 1;
  return {
    id: `ingredient-${nextId}`,
    quantity: null,
    unit: null,
    food: null,
    note: "",
    originalText: "",
    fixed: false,
    ...overrides,
  };
}

function component(ingredients: Ingredient[]): Pick<Part, "ingredients"> {
  return { ingredients };
}

describe("mergeIngredients", () => {
  test("same food and unit across parts: quantities summed into one line", () => {
    const flourA = ingredient({ quantity: 200, unit: gram, food: flour });
    const flourB = ingredient({ quantity: 50, unit: gram, food: flour });
    const merged = mergeIngredients({
      parts: [component([flourA]), component([flourB])],
    });

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ quantity: 250, unit: gram, food: flour, id: flourA.id });
  });

  test("different unit keeps lines separate even for the same food", () => {
    const grams = ingredient({ quantity: 200, unit: gram, food: flour });
    const cups = ingredient({ quantity: 1, unit: cup, food: flour });
    const merged = mergeIngredients({ parts: [component([grams, cups])] });

    expect(merged).toHaveLength(2);
    expect(merged.map((i) => i.quantity)).toEqual([200, 1]);
  });

  test("different food keeps lines separate even for the same unit", () => {
    const flourLine = ingredient({ quantity: 200, unit: gram, food: flour });
    const saltLine = ingredient({ quantity: 5, unit: gram, food: salt });
    const merged = mergeIngredients({ parts: [component([flourLine, saltLine])] });

    expect(merged).toHaveLength(2);
  });

  test("fixed ingredients are never merged, even with a matching food and unit", () => {
    const linear = ingredient({ quantity: 1, unit: cup, food: vanilla });
    const fixedA = ingredient({ quantity: 1, unit: cup, food: vanilla, fixed: true });
    const fixedB = ingredient({ quantity: 1, unit: cup, food: vanilla, fixed: true });
    const merged = mergeIngredients({ parts: [component([linear, fixedA, fixedB])] });

    // The linear one stands alone; each fixed line keeps its own too.
    expect(merged).toHaveLength(3);
    expect(merged.filter((i) => i.fixed)).toHaveLength(2);
  });

  test("null-quantity ingredients are never merged, even with a matching food and unit", () => {
    const toTaste1 = ingredient({ quantity: null, food: salt, note: "to taste" });
    const toTaste2 = ingredient({ quantity: null, food: salt, note: "to taste" });
    const merged = mergeIngredients({ parts: [component([toTaste1, toTaste2])] });

    expect(merged).toHaveLength(2);
    expect(merged.every((i) => i.quantity === null)).toBe(true);
  });

  test("a food-less line merges by its raw text, so identical unparsed lines combine and different ones don't", () => {
    const basilA = ingredient({ quantity: 1, food: null, originalText: "a handful of basil" });
    const basilB = ingredient({ quantity: 1, food: null, originalText: "a handful of basil" });
    const mint = ingredient({ quantity: 1, food: null, originalText: "a sprig of mint" });
    const merged = mergeIngredients({ parts: [component([basilA, basilB, mint])] });

    expect(merged).toHaveLength(2);
    const basilLine = merged.find((i) => i.originalText === "a handful of basil")!;
    expect(basilLine.quantity).toBe(2);
  });

  test("matching notes are kept; differing notes are dropped rather than picking one", () => {
    const sifted = ingredient({ quantity: 100, unit: gram, food: flour, note: "sifted" });
    const alsoSifted = ingredient({ quantity: 50, unit: gram, food: flour, note: "sifted" });
    const same = mergeIngredients({ parts: [component([sifted, alsoSifted])] });
    expect(same).toHaveLength(1);
    expect(same[0]!.note).toBe("sifted");

    const forDusting = ingredient({ quantity: 100, unit: gram, food: flour, note: "sifted" });
    const plain = ingredient({ quantity: 50, unit: gram, food: flour, note: "for dusting" });
    const differing = mergeIngredients({ parts: [component([forDusting, plain])] });
    expect(differing).toHaveLength(1);
    expect(differing[0]!.note).toBe("");
  });

  test("output order follows first occurrence across components", () => {
    const eggs = ingredient({ quantity: 2, food: { ...flour, id: "eggs-id", name: "egg" } });
    const flourLine = ingredient({ quantity: 200, unit: gram, food: flour });
    const moreEggs = ingredient({ quantity: 1, food: { ...flour, id: "eggs-id", name: "egg" } });
    const merged = mergeIngredients({ parts: [component([eggs, flourLine]), component([moreEggs])] });

    expect(merged.map((i) => i.food?.id)).toEqual(["eggs-id", flour.id]);
    expect(merged[0]!.quantity).toBe(3);
  });

  test("no ingredients anywhere: an empty list", () => {
    expect(mergeIngredients({ parts: [component([]), component([])] })).toEqual([]);
  });

  test("does not mutate the input ingredients", () => {
    const flourA = ingredient({ quantity: 200, unit: gram, food: flour });
    const flourB = ingredient({ quantity: 50, unit: gram, food: flour });
    mergeIngredients({ parts: [component([flourA, flourB])] });

    expect(flourA.quantity).toBe(200);
    expect(flourB.quantity).toBe(50);
  });
});
