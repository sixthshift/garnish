import { describe, expect, test } from "vitest";
import { parseUnit, type UnitCandidate } from "../../src/domain/parseUnit";

const unit = (name: string, pluralName: string | null, abbreviation: string): UnitCandidate => ({
  name,
  pluralName,
  abbreviation,
});

const GRAM = unit("gram", "grams", "g");
const TABLESPOON = unit("tablespoon", "tablespoons", "tbsp");
const TEASPOON = unit("teaspoon", "teaspoons", "tsp");
const MILLILITRE = unit("millilitre", "millilitres", "ml");
const CUP = unit("cup", "cups", "cup");
const OUNCE = unit("ounce", "ounces", "oz");
const FLUID_OUNCE = unit("fluid ounce", "fluid ounces", "fl oz");

const UNITS = [GRAM, TABLESPOON, TEASPOON, MILLILITRE, CUP, OUNCE, FLUID_OUNCE];

describe("parseUnit", () => {
  describe("matches by name", () => {
    test.each([
      ["tablespoon sugar", TABLESPOON, "sugar"],
      ["cup flour", CUP, "flour"],
      ["gram butter", GRAM, "butter"],
    ] as const)("%s", (rest, expected, remainder) => {
      expect(parseUnit(rest, UNITS)).toEqual({ unit: expected, rest: remainder });
    });
  });

  describe("matches by plural", () => {
    test.each([
      ["tablespoons sugar", TABLESPOON, "sugar"],
      ["cups flour", CUP, "flour"],
      ["grams butter", GRAM, "butter"],
    ] as const)("%s", (rest, expected, remainder) => {
      expect(parseUnit(rest, UNITS)).toEqual({ unit: expected, rest: remainder });
    });
  });

  describe("matches by abbreviation", () => {
    test.each([
      ["g butter", GRAM, "butter"],
      ["tsp salt", TEASPOON, "salt"],
      ["tbsp oil", TABLESPOON, "oil"],
      ["ml milk", MILLILITRE, "milk"],
    ] as const)("%s", (rest, expected, remainder) => {
      expect(parseUnit(rest, UNITS)).toEqual({ unit: expected, rest: remainder });
    });
  });

  test("matching is case-insensitive on the three fields", () => {
    expect(parseUnit("TABLESPOON sugar", UNITS)).toEqual({ unit: TABLESPOON, rest: "sugar" });
    expect(parseUnit("Tbsp sugar", UNITS)).toEqual({ unit: TABLESPOON, rest: "sugar" });
    expect(parseUnit("CUPS flour", UNITS)).toEqual({ unit: CUP, rest: "flour" });
  });

  describe("the alias map", () => {
    test.each([
      ["tbs sugar", TABLESPOON, "sugar"],
      ["tblsp sugar", TABLESPOON, "sugar"],
      ["gr butter", GRAM, "butter"],
      ["mls milk", MILLILITRE, "milk"],
    ] as const)("%s", (rest, expected, remainder) => {
      expect(parseUnit(rest, UNITS)).toEqual({ unit: expected, rest: remainder });
    });

    test("T and t are case-sensitive: uppercase is tablespoon, lowercase teaspoon", () => {
      expect(parseUnit("T sugar", UNITS)).toEqual({ unit: TABLESPOON, rest: "sugar" });
      expect(parseUnit("t sugar", UNITS)).toEqual({ unit: TEASPOON, rest: "sugar" });
    });

    test("an alias whose target unit isn't in the given vocabulary has no match", () => {
      expect(parseUnit("T sugar", [GRAM])).toEqual({ unit: null, rest: "T sugar" });
    });
  });

  describe("longest match wins", () => {
    test("fluid ounce over ounce", () => {
      expect(parseUnit("fluid ounce milk", UNITS)).toEqual({ unit: FLUID_OUNCE, rest: "milk" });
      expect(parseUnit("fl oz milk", UNITS)).toEqual({ unit: FLUID_OUNCE, rest: "milk" });
    });

    test("the shorter unit still matches on its own", () => {
      expect(parseUnit("ounce butter", UNITS)).toEqual({ unit: OUNCE, rest: "butter" });
      expect(parseUnit("oz butter", UNITS)).toEqual({ unit: OUNCE, rest: "butter" });
    });
  });

  test("a unit name that is merely a prefix of the next word does not match", () => {
    expect(parseUnit("cupcakes", UNITS)).toEqual({ unit: null, rest: "cupcakes" });
  });

  describe("no match", () => {
    test.each(["plain flour", "salt, to taste", ""])("%s", (line) => {
      expect(parseUnit(line, UNITS)).toEqual({ unit: null, rest: line });
    });
  });
});
