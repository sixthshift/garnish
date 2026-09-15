// Clipboard text: the ingredient list "Copy ingredients" writes, and the link
// "Copy link" writes. Both pure.
import { describe, expect, test } from "vitest";
import { ingredientLines, ingredientsText, recipeUrl } from "../../../src/domain/recipe/copy";
import type { Ingredient } from "../../../src/domain/recipe/recipe";

const food = (name: string, pluralName: string | null = null) => ({
  id: crypto.randomUUID(),
  name,
  pluralName,
  aliases: [],
  aisle: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
});

const unit = (name: string, pluralName: string | null = null) => ({
  id: crypto.randomUUID(),
  name,
  pluralName,
  abbreviation: "",
  useAbbreviation: false,
  fraction: true,
  standardQuantity: null,
  standardUnitId: null,
});

function ingredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    id: crypto.randomUUID(),
    quantity: null,
    unit: null,
    food: null,
    note: "",
    originalText: "",
    fixed: false,
    ...overrides,
  };
}

describe("ingredientLines", () => {
  test("formats each line and drops the ones with nothing to show", () => {
    const lines = ingredientLines([
      ingredient({ quantity: 200, unit: unit("gram", "grams"), food: food("flour") }),
      ingredient({ food: food("salt"), note: "to taste" }),
      ingredient(), // nothing at all
    ]);
    expect(lines).toEqual(["200 grams flour", "salt, to taste"]);
  });

  test("a line that only ever had raw text keeps that text", () => {
    expect(ingredientLines([ingredient({ originalText: "a good glug of oil" })])).toEqual(["a good glug of oil"]);
  });
});

describe("ingredientsText", () => {
  test("a flat recipe is the name, a blank line, then one line per ingredient", () => {
    const text = ingredientsText({
      name: "Lemon tart",
      parts: [
        {
          name: "",
          ingredients: [
            ingredient({ quantity: 200, unit: unit("gram", "grams"), food: food("flour") }),
            ingredient({ quantity: 2, food: food("egg", "eggs") }),
          ],
        },
      ],
    });
    expect(text).toBe("Lemon tart\n\n200 grams flour\n2 eggs");
  });

  test("named components become headings, blank-line separated", () => {
    const text = ingredientsText({
      name: "Tart",
      parts: [
        { name: "Pastry", ingredients: [ingredient({ quantity: 200, unit: unit("gram", "grams"), food: food("flour") })] },
        { name: "Filling", ingredients: [ingredient({ quantity: 3, food: food("lemon", "lemons") })] },
      ],
    });
    expect(text).toBe("Tart\n\nPastry:\n200 grams flour\n\nFilling:\n3 lemons");
  });

  test("a component with no printable ingredients is skipped, heading and all", () => {
    const text = ingredientsText({
      name: "Tart",
      parts: [
        { name: "Pastry", ingredients: [ingredient({ quantity: 200, unit: unit("gram", "grams"), food: food("flour") })] },
        { name: "Filling", ingredients: [] },
      ],
    });
    expect(text).toBe("Tart\n\nPastry:\n200 grams flour");
  });

  test("a recipe with nothing to copy is empty, not a lone name", () => {
    expect(ingredientsText({ name: "Tart", parts: [{ name: "", ingredients: [] }] })).toBe("");
  });
});

describe("recipeUrl", () => {
  test("is the recipe's page on this host", () => {
    expect(recipeUrl("http://garnish.local:3000", "lemon-tart")).toBe("http://garnish.local:3000/recipes/lemon-tart");
  });

  test("a trailing slash on the origin does not double up", () => {
    expect(recipeUrl("http://garnish.local/", "lemon-tart")).toBe("http://garnish.local/recipes/lemon-tart");
  });

  test("no origin still gives a usable relative path", () => {
    expect(recipeUrl("", "lemon-tart")).toBe("/recipes/lemon-tart");
  });
});
