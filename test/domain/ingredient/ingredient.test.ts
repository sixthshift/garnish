import { describe, expect, test } from "vitest";
import { type DisplayFood, type DisplayIngredient, type DisplayUnit, formatIngredient, inflectIngredient } from "../../../src/domain/ingredient/format";

const unit = (overrides: Partial<DisplayUnit>): DisplayUnit => ({
  name: "cup",
  pluralName: "cups",
  abbreviation: "cup",
  useAbbreviation: false,
  fraction: true,
  portion: false,
  ...overrides,
});

const cup = unit({});
const gram = unit({ name: "gram", pluralName: "grams", abbreviation: "g", useAbbreviation: true, fraction: false });
const tsp = unit({ name: "teaspoon", pluralName: "teaspoons", abbreviation: "tsp", useAbbreviation: true });
const clove = unit({ name: "clove", pluralName: "cloves", abbreviation: "clove" });
const slice = unit({ name: "slice", pluralName: "slices", abbreviation: "slice", portion: true });

const flour: DisplayFood = { name: "flour", pluralName: null };
const egg: DisplayFood = { name: "egg", pluralName: "eggs" };
const salt: DisplayFood = { name: "salt", pluralName: "" }; // empty plural falls back to the name
const garlic: DisplayFood = { name: "garlic", pluralName: null };
const blueberry: DisplayFood = { name: "blueberry", pluralName: "blueberries" };
const lemon: DisplayFood = { name: "lemon", pluralName: "lemons" };

const ingredient = (overrides: Partial<DisplayIngredient>): DisplayIngredient => ({
  quantity: null,
  unit: null,
  food: null,
  note: "",
  originalText: "",
  ...overrides,
});

describe("inflectIngredient", () => {
  const food = (quantity: number | null, u: DisplayUnit | null, f: DisplayFood | null) => {
    const tokens = inflectIngredient(ingredient({ quantity, unit: u, food: f }));
    return tokens.raw ? tokens.text : tokens.food;
  };

  describe("a bare count: singular at 1 or below, plural above", () => {
    test.each([
      [2, egg, "eggs"],
      [1.5, egg, "eggs"],
      [12, egg, "eggs"],
      [1, egg, "egg"],
      [0.5, egg, "egg"],
      // no amount reads as plural
      [0, egg, "eggs"],
      [null, egg, "eggs"],
    ])("%s x %o -> %s", (quantity, f, expected) => {
      expect(food(quantity, null, f)).toBe(expected);
    });
  });

  describe("a measure: plural whatever the amount", () => {
    test.each([
      [1, cup, blueberry, "blueberries"],
      [0.5, cup, blueberry, "blueberries"],
      [2, cup, blueberry, "blueberries"],
      [1, gram, egg, "eggs"],
      [0.25, tsp, lemon, "lemons"],
    ])("%s %o x %o -> %s", (quantity, u, f, expected) => {
      expect(food(quantity, u, f)).toBe(expected);
    });
  });

  describe("a portion: the food stays singular", () => {
    test.each([
      [1, lemon, "lemon"],
      [2, lemon, "lemon"],
      [0.5, lemon, "lemon"],
    ])("%s slice x %o -> %s", (quantity, f, expected) => {
      expect(food(quantity, slice, f)).toBe(expected);
    });
  });

  test("a unit without an amount is skipped, so the food reads as a bare count", () => {
    expect(food(null, slice, lemon)).toBe("lemons");
    expect(food(0, cup, blueberry)).toBe("blueberries");
  });

  test("no plural: the name", () => {
    expect(food(2, null, flour)).toBe("flour");
    expect(food(null, null, flour)).toBe("flour");
    expect(food(2, null, salt)).toBe("salt");
    expect(food(1, cup, salt)).toBe("salt");
  });

  test("tokens: each piece formatted, none joined", () => {
    expect(inflectIngredient(ingredient({ quantity: 1.5, unit: cup, food: blueberry, note: " washed " }))).toEqual({
      raw: false,
      quantity: "1½",
      unit: "cups",
      food: "blueberries",
      note: "washed",
    });
    expect(inflectIngredient(ingredient({ unit: cup, food: flour }))).toEqual({ raw: false, quantity: "", unit: "", food: "flour", note: "" });
    expect(inflectIngredient(ingredient({}))).toEqual({ raw: false, quantity: "", unit: "", food: "", note: "" });
  });

  test("no food but an originalText: the raw line, verbatim", () => {
    expect(inflectIngredient(ingredient({ quantity: 2, unit: cup, note: "sifted", originalText: " a handful of basil " }))).toEqual({
      raw: true,
      text: "a handful of basil",
    });
  });
});

describe("formatIngredient", () => {
  describe("full lines", () => {
    test.each([
      [ingredient({ quantity: 1.5, unit: cup, food: flour, note: "sifted" }), "1½ cups flour, sifted"],
      [ingredient({ quantity: 250, unit: gram, food: flour }), "250 g flour"],
      [ingredient({ quantity: 2, unit: cup, food: egg }), "2 cups eggs"],
      [ingredient({ quantity: 1, unit: cup, food: blueberry }), "1 cup blueberries"], // a measure takes the plural at 1
      [ingredient({ quantity: 2, unit: slice, food: lemon }), "2 slices lemon"], // a portion keeps the food singular
      [ingredient({ quantity: 0.5, unit: tsp, food: salt }), "½ tsp salt"],
      [ingredient({ quantity: 2, unit: clove, food: garlic, note: "crushed" }), "2 cloves garlic, crushed"],
      [ingredient({ quantity: 1, unit: clove, food: garlic }), "1 clove garlic"],
    ])("%o -> %s", (ing, expected) => {
      expect(formatIngredient(ing)).toBe(expected);
    });
  });

  describe("food null, originalText present: the original line verbatim", () => {
    test("with a parsed amount, the amount is not prefixed", () => {
      const ing = ingredient({ quantity: 2, unit: cup, note: "sifted", originalText: "2 cups plain flour, sifted" });
      expect(formatIngredient(ing)).toBe("2 cups plain flour, sifted");
    });

    test("with nothing else parsed", () => {
      expect(formatIngredient(ingredient({ originalText: "a handful of fresh basil" }))).toBe("a handful of fresh basil");
    });

    test("the note is not appended twice", () => {
      const ing = ingredient({ note: "to taste", originalText: "salt to taste" });
      expect(formatIngredient(ing)).toBe("salt to taste");
    });

    test("surrounding whitespace is trimmed", () => {
      expect(formatIngredient(ingredient({ originalText: "  2 cups flour  " }))).toBe("2 cups flour");
    });

    test("a food present ignores originalText", () => {
      const ing = ingredient({ quantity: 2, unit: cup, food: flour, originalText: "2 cups plain flour" });
      expect(formatIngredient(ing)).toBe("2 cups flour");
    });

    test("whitespace-only originalText counts as absent", () => {
      expect(formatIngredient(ingredient({ quantity: 2, unit: cup, originalText: "   " }))).toBe("2 cups");
    });
  });

  describe("food null, originalText null: amount and note only", () => {
    test.each([
      [ingredient({ quantity: 2, unit: cup, note: "water" }), "2 cups, water"],
      [ingredient({ quantity: 2, unit: cup }), "2 cups"],
      [ingredient({ quantity: 3, note: "large" }), "3, large"],
      [ingredient({ note: "to taste" }), "to taste"],
    ])("%o -> %s", (ing, expected) => {
      expect(formatIngredient(ing)).toBe(expected);
    });
  });

  describe("quantity null or 0: unit skipped, food and note only", () => {
    test.each([
      [ingredient({ unit: tsp, food: salt, note: "to taste" }), "salt, to taste"],
      [ingredient({ unit: cup, food: flour }), "flour"],
      [ingredient({ quantity: 0, unit: cup, food: egg }), "eggs"],
      [ingredient({ unit: cup, note: "for dusting" }), "for dusting"], // no food either: unit still skipped
      [ingredient({ food: egg }), "eggs"],
    ])("%o -> %s", (ing, expected) => {
      expect(formatIngredient(ing)).toBe(expected);
    });
  });

  describe("unit null: quantity and food", () => {
    test.each([
      [ingredient({ quantity: 2, food: egg }), "2 eggs"],
      [ingredient({ quantity: 1, food: egg }), "1 egg"],
      [ingredient({ quantity: 1.5, food: egg }), "1.5 eggs"], // no unit: decimals
      [ingredient({ quantity: 3, food: egg, note: "beaten" }), "3 eggs, beaten"],
    ])("%o -> %s", (ing, expected) => {
      expect(formatIngredient(ing)).toBe(expected);
    });
  });

  test("note null: no trailing note or comma", () => {
    expect(formatIngredient(ingredient({ quantity: 2, unit: cup, food: flour }))).toBe("2 cups flour");
    expect(formatIngredient(ingredient({ quantity: 2, unit: cup, food: flour, note: "  " }))).toBe("2 cups flour");
  });

  test("everything null: empty string", () => {
    expect(formatIngredient(ingredient({}))).toBe("");
    expect(formatIngredient(ingredient({ quantity: 0 }))).toBe("");
  });

  test("is pure: the input is not mutated", () => {
    const ing = ingredient({ quantity: 1.5, unit: cup, food: flour, note: "sifted" });
    const before = structuredClone(ing);
    formatIngredient(ing);
    expect(ing).toEqual(before);
  });
});
