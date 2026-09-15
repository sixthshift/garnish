// convert(): a food's own conversions, then a unit's standard_* base-unit
// link, chained one hop of each. See src/domain/reference/convert.ts.
import { describe, expect, test } from "vitest";
import { convert } from "../../../src/domain/reference/convert";
import type { Food, Unit } from "../../../src/domain/reference/reference";

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

const teaspoon: Unit = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  name: "teaspoon",
  pluralName: "teaspoons",
  abbreviation: "tsp",
  useAbbreviation: true,
  fraction: true,
  standardQuantity: null,
  standardUnitId: null,
};

// "1 cup of plain flour is 125 g" (decisions.md row 69).
const flour: Food = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "flour",
  pluralName: null,
  aliases: [],
  aisle: null,
  recipeId: null,
  skipShopping: false,
  conversions: [{ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 125 }],
};

describe("convert", () => {
  test("direct: a food conversion from unit to toUnit", () => {
    expect(convert(2, cup, flour, gram)).toBe(250);
  });

  test("reverse: a food conversion stored the other way round", () => {
    expect(convert(250, gram, flour, cup)).toBe(2);
  });

  test("one-hop chained: a food conversion to grams, then the toUnit's own standard link to grams", () => {
    // 1 cup -> 125 g (food conversion) -> 0.125 kg (kilogram.standardQuantity/standardUnitId).
    expect(convert(1, cup, flour, kilogram)).toBeCloseTo(0.125);
  });

  test("chained the other way: a unit's standard link, then a food conversion", () => {
    // 2 kg -> 2000 g (unit standard) -> 16 cups (food conversion, reversed).
    expect(convert(2, kilogram, flour, cup)).toBeCloseTo(16);
  });

  test("no path: neither a food conversion nor a standard link connects the units", () => {
    expect(convert(1, cup, flour, teaspoon)).toBeNull();
  });

  test("the same unit both ways converts at 1:1 with no conversion data", () => {
    const noConversions: Food = { ...flour, conversions: [] };
    expect(convert(3, gram, noConversions, gram)).toBe(3);
  });
});
