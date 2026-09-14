import { describe, expect, test } from "vitest";
import { parseQuantity } from "../../../src/domain/ingredient/parseQuantity";

describe("parseQuantity", () => {
  describe("plain numbers", () => {
    test.each([
      ["2 cups flour", 2, "cups flour"],
      ["12 eggs", 12, "eggs"],
      ["0.75 cup milk", 0.75, "cup milk"],
      ["1.5 tbsp oil", 1.5, "tbsp oil"],
      ["250 g butter", 250, "g butter"],
      ["3", 3, ""],
    ])("%s", (line, quantity, rest) => {
      expect(parseQuantity(line)).toEqual({ quantity, fixed: false, rest });
    });
  });

  describe("fractions", () => {
    test.each([
      ["3/4 cup sugar", 0.75, "cup sugar"],
      ["1/2 lemon", 0.5, "lemon"],
      ["1 1/2 cups flour", 1.5, "cups flour"],
      ["2 1/4 tsp salt", 2.25, "tsp salt"],
      ["1 1/2", 1.5, ""],
      ["3 / 4 cup", 0.75, "cup"],
    ])("%s", (line, quantity, rest) => {
      expect(parseQuantity(line)).toEqual({ quantity, fixed: false, rest });
    });
  });

  // Every glyph in format.ts's VULGAR_FRACTIONS, alone and after a whole number.
  describe("vulgar glyphs", () => {
    test.each([
      ["⅒", 1 / 10],
      ["⅑", 1 / 9],
      ["⅛", 1 / 8],
      ["⅐", 1 / 7],
      ["⅙", 1 / 6],
      ["⅕", 1 / 5],
      ["¼", 1 / 4],
      ["⅓", 1 / 3],
      ["⅜", 3 / 8],
      ["⅖", 2 / 5],
      ["½", 1 / 2],
      ["⅗", 3 / 5],
      ["⅝", 5 / 8],
      ["⅔", 2 / 3],
      ["¾", 3 / 4],
      ["⅘", 4 / 5],
      ["⅚", 5 / 6],
      ["⅞", 7 / 8],
    ])("%s alone", (glyph, value) => {
      expect(parseQuantity(`${glyph} cup milk`)).toEqual({ quantity: value, fixed: false, rest: "cup milk" });
    });

    test.each([
      ["⅒", 1 / 10],
      ["⅑", 1 / 9],
      ["⅛", 1 / 8],
      ["⅐", 1 / 7],
      ["⅙", 1 / 6],
      ["⅕", 1 / 5],
      ["¼", 1 / 4],
      ["⅓", 1 / 3],
      ["⅜", 3 / 8],
      ["⅖", 2 / 5],
      ["½", 1 / 2],
      ["⅗", 3 / 5],
      ["⅝", 5 / 8],
      ["⅔", 2 / 3],
      ["¾", 3 / 4],
      ["⅘", 4 / 5],
      ["⅚", 5 / 6],
      ["⅞", 7 / 8],
    ])("1%s as a mixed number", (glyph, value) => {
      expect(parseQuantity(`1${glyph} cups flour`)).toEqual({ quantity: 1 + value, fixed: false, rest: "cups flour" });
    });

    test("a space between the whole number and the glyph", () => {
      expect(parseQuantity("2 ½ cups flour")).toEqual({ quantity: 2.5, fixed: false, rest: "cups flour" });
    });
  });

  describe("a and an", () => {
    test.each([
      ["a pinch of salt", "pinch of salt"],
      ["an egg", "egg"],
      ["A handful of parsley", "handful of parsley"],
      ["An onion, diced", "onion, diced"],
    ])("%s", (line, rest) => {
      expect(parseQuantity(line)).toEqual({ quantity: 1, fixed: false, rest });
    });

    test("a word merely starting with a is not an amount", () => {
      expect(parseQuantity("avocado, sliced")).toEqual({ quantity: null, fixed: false, rest: "avocado, sliced" });
    });
  });

  describe("fixed quantities", () => {
    test.each([
      ["=1 tsp salt", 1, "tsp salt"],
      ["= 2 bay leaves", 2, "bay leaves"],
      ["=½ tsp vanilla", 0.5, "tsp vanilla"],
      ["=a pinch of chilli", 1, "pinch of chilli"],
    ])("%s", (line, quantity, rest) => {
      expect(parseQuantity(line)).toEqual({ quantity, fixed: true, rest });
    });

    test("an = with no amount behind it is left in the text", () => {
      expect(parseQuantity("=salt to taste")).toEqual({ quantity: null, fixed: false, rest: "=salt to taste" });
    });
  });

  describe("ranges take the low value", () => {
    test.each([
      ["1-2 tbsp oil", 1, "tbsp oil"],
      ["1 - 2 tbsp oil", 1, "tbsp oil"],
      ["1 to 2 tbsp oil", 1, "tbsp oil"],
      ["2 – 3 cloves garlic", 2, "cloves garlic"],
      ["2 — 3 cloves garlic", 2, "cloves garlic"],
      ["1/2 to 1 cup water", 0.5, "cup water"],
      ["½-1 tsp chilli", 0.5, "tsp chilli"],
      ["=1-2 bay leaves", 1, "bay leaves"],
    ])("%s", (line, quantity, rest) => {
      expect(parseQuantity(line)).toEqual({ quantity, fixed: line.startsWith("="), rest });
    });

    test("a hyphenated word after the number is not a range", () => {
      expect(parseQuantity("2-inch piece of ginger")).toEqual({ quantity: 2, fixed: false, rest: "-inch piece of ginger" });
    });

    test("to without a following amount is not a range", () => {
      expect(parseQuantity("1 tsp salt, to taste")).toEqual({ quantity: 1, fixed: false, rest: "tsp salt, to taste" });
    });
  });

  describe("no leading amount", () => {
    test.each(["salt, to taste", "freshly ground black pepper", "  olive oil  ", ""])("%s", (line) => {
      expect(parseQuantity(line)).toEqual({ quantity: null, fixed: false, rest: line });
    });
  });
});
