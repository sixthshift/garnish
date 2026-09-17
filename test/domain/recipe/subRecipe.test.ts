// subRecipeScale() and its helpers: the servings of a child recipe that yield
// an ingredient's amount, over matching units, convertible units and unrelated
// ones. See src/domain/recipe/subRecipe.ts.
import { describe, expect, test } from "vitest";
import type { Ingredient } from "../../../src/domain/recipe/recipe";
import { type SubRecipe, subRecipeHint, subRecipeMap, subRecipeScale } from "../../../src/domain/recipe/subRecipe";
import type { Food, Unit } from "../../../src/domain/reference";

const gram: Unit = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  standardQuantity: null,
  standardUnitId: null,
};

const kilogram: Unit = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "kilogram",
  pluralName: "kilograms",
  abbreviation: "kg",
  useAbbreviation: true,
  fraction: false,
  standardQuantity: 1000,
  standardUnitId: gram.id,
};

const cup: Unit = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  name: "cup",
  pluralName: "cups",
  abbreviation: "cup",
  useAbbreviation: false,
  fraction: true,
  standardQuantity: null,
  standardUnitId: null,
};

const litre: Unit = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  name: "litre",
  pluralName: "litres",
  abbreviation: "l",
  useAbbreviation: true,
  fraction: false,
  standardQuantity: null,
  standardUnitId: null,
};

const CHILD_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

/** A pastry food made by the child recipe, with whatever conversions the case needs. */
const pastry = (conversions: Food["conversions"] = []): Food => ({
  id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  name: "pastry",
  pluralName: null,
  aliases: [],
  aisle: null,
  recipeId: CHILD_ID,
  skipShopping: false,
  conversions,
});

/** "1 cup of pastry is 250 g." */
const cupToGram: Food["conversions"] = [{ id: "11111111-1111-4111-8111-111111111111", unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 250 }];

const child = (overrides: Partial<SubRecipe> = {}): SubRecipe => ({
  id: CHILD_ID,
  slug: "sweet-pastry",
  name: "Sweet pastry",
  recipeServings: 4,
  recipeYieldQuantity: 500,
  yieldUnit: gram,
  ...overrides,
});

const row = (overrides: Partial<Ingredient> = {}): Ingredient => ({
  id: "22222222-2222-4222-8222-222222222222",
  quantity: 250,
  unit: gram,
  food: pastry(),
  note: "",
  originalText: "",
  fixed: false,
  ...overrides,
});

describe("subRecipeScale", () => {
  test("matching units: the amount over the yield, times the child's servings", () => {
    // 250 g of a child yielding 500 g at 4 servings is half a batch: 2 servings.
    expect(subRecipeScale(row(), child())).toBe(2);
    expect(subRecipeScale(row({ quantity: 500 }), child())).toBe(4);
    expect(subRecipeScale(row({ quantity: 750 }), child())).toBe(6);
  });

  test("a unit that converts to the yield unit through the unit's own standard link", () => {
    // 1 kg is 1000 g, so twice a 500 g yield: 8 servings.
    expect(subRecipeScale(row({ quantity: 1, unit: kilogram }), child())).toBe(8);
  });

  test("a unit that converts through the food's own conversion", () => {
    // 1 cup of pastry is 250 g, half the 500 g yield: 2 servings.
    expect(subRecipeScale(row({ quantity: 1, unit: cup, food: pastry(cupToGram) }), child())).toBe(2);
  });

  test("a conversion and a standard link chained, through the child's yield in kilograms", () => {
    // 2 cups is 500 g is 0.5 kg, against a 1 kg yield at 4 servings: 2 servings.
    const inKilograms = child({ recipeYieldQuantity: 1, yieldUnit: kilogram });
    expect(subRecipeScale(row({ quantity: 2, unit: cup, food: pastry(cupToGram) }), inKilograms)).toBe(2);
  });

  test("unrelated units are null: the link shows with no hint", () => {
    expect(subRecipeScale(row({ quantity: 1, unit: cup }), child())).toBeNull();
    expect(subRecipeScale(row({ quantity: 1, unit: litre }), child())).toBeNull();
  });

  test("one side without a unit relates to nothing", () => {
    expect(subRecipeScale(row({ unit: null }), child())).toBeNull();
    expect(subRecipeScale(row(), child({ yieldUnit: null }))).toBeNull();
  });

  test("both sides countless compare the bare quantities", () => {
    // "2 tart shells" of a child that makes 12 at 12 servings.
    const countless = child({ recipeServings: 12, recipeYieldQuantity: 12, yieldUnit: null });
    expect(subRecipeScale(row({ quantity: 2, unit: null }), countless)).toBe(2);
  });

  test("no amount, no yield or no servings to scale by is null", () => {
    expect(subRecipeScale(row({ quantity: null }), child())).toBeNull();
    expect(subRecipeScale(row({ quantity: 0 }), child())).toBeNull();
    expect(subRecipeScale(row(), child({ recipeYieldQuantity: 0 }))).toBeNull();
    expect(subRecipeScale(row(), child({ recipeServings: 0 }))).toBeNull();
  });

  test("a text-only row cannot use the food's conversions, but a matching unit still works", () => {
    expect(subRecipeScale(row({ food: null, unit: cup }), child())).toBeNull();
    expect(subRecipeScale(row({ food: null }), child())).toBe(2);
  });
});

describe("subRecipeHint", () => {
  test("names the servings, singular at one, rounded to two places", () => {
    expect(subRecipeHint(2)).toBe("Make 2 servings");
    expect(subRecipeHint(1)).toBe("Make 1 serving");
    expect(subRecipeHint(2 / 3)).toBe("Make 0.67 servings");
    expect(subRecipeHint(1.5)).toBe("Make 1.5 servings");
  });
});

describe("subRecipeMap", () => {
  test("keys the children by recipe id", () => {
    const map = subRecipeMap([child()]);
    expect(map.get(CHILD_ID)?.slug).toBe("sweet-pastry");
    expect(map.get("nothing")).toBeUndefined();
  });
});
