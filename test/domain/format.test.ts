import { describe, expect, test } from "vitest";
import { type DisplayUnit, formatAmount, formatDuration, formatQuantity, formatUnit, formatYield, totalMinutes } from "../../src/domain/format";

// Realistic rows, mirroring src/db/seed.ts DEFAULT_UNITS.
const unit = (overrides: Partial<DisplayUnit>): DisplayUnit => ({
  name: "cup",
  pluralName: "cups",
  abbreviation: "cup",
  useAbbreviation: false,
  fraction: true,
  ...overrides,
});

const cup = unit({});
const gram = unit({ name: "gram", pluralName: "grams", abbreviation: "g", useAbbreviation: true, fraction: false });
const tbsp = unit({ name: "tablespoon", pluralName: "tablespoons", abbreviation: "tbsp", useAbbreviation: true });
const litre = unit({ name: "litre", pluralName: "litres", abbreviation: "l", useAbbreviation: true, fraction: false });
const pinch = unit({ name: "pinch", pluralName: "pinches", abbreviation: "pinch" });
const noPlural = unit({ name: "dash", pluralName: null, abbreviation: "" });
const abbreviationFlagNoText = unit({ name: "each", pluralName: "each", abbreviation: "", useAbbreviation: true, fraction: false });
const decimalWithPlural = unit({ name: "bottle", pluralName: "bottles", abbreviation: "", useAbbreviation: false, fraction: false });

describe("formatQuantity", () => {
  describe("with unit.fraction", () => {
    test.each([
      [0.5, "½"],
      [0.33, "⅓"],
      [1 / 3, "⅓"],
      [0.66, "⅔"],
      [0.25, "¼"],
      [0.75, "¾"],
      [0.125, "⅛"],
      [0.375, "⅜"],
      [0.625, "⅝"],
      [0.875, "⅞"],
      [0.2, "⅕"],
      [0.4, "⅖"],
      [0.6, "⅗"],
      [0.8, "⅘"],
      [1 / 6, "⅙"],
      [5 / 6, "⅚"],
      [1 / 7, "⅐"],
      [1 / 9, "⅑"],
      [0.1, "⅒"],
      [1.5, "1½"],
      [2.25, "2¼"],
      [3.75, "3¾"],
      [1.33, "1⅓"],
      [12.5, "12½"],
      [1, "1"],
      [2, "2"],
      [3.0, "3"],
      [2.96, "3"], // rounds up to the next whole
      [0.98, "1"],
      [1.02, "1"], // rounds down to the whole
      [0.49, "½"],
      [0.3, "⅓"], // nearest glyph, not exact
      [0.7, "⅔"],
    ])("%d -> %s", (quantity, expected) => {
      expect(formatQuantity(quantity, cup)).toBe(expected);
    });

    test("an amount too small for any glyph falls back to decimals", () => {
      expect(formatQuantity(0.02, cup)).toBe("0.02");
      expect(formatQuantity(0.04, cup)).toBe("0.04");
    });
  });

  describe("without unit.fraction", () => {
    test.each([
      [1.5, "1.5"],
      [1.25, "1.25"],
      [2, "2"],
      [2.0, "2"],
      [250, "250"],
      [0.5, "0.5"],
      [0.75, "0.75"],
      [0.125, "0.13"],
      [1.005, "1"], // float: 1.005 is just under, toFixed rounds down
      [33.333333, "33.33"],
      [66.666666, "66.67"],
      [1000, "1000"], // no thousands separator
      [0.001, "0"],
    ])("%d -> %s", (quantity, expected) => {
      expect(formatQuantity(quantity, gram)).toBe(expected);
    });

    test("no unit means decimals", () => {
      expect(formatQuantity(1.5, null)).toBe("1.5");
      expect(formatQuantity(1.5)).toBe("1.5");
      expect(formatQuantity(0.25)).toBe("0.25");
    });
  });

  test.each([
    [null, cup],
    [null, gram],
    [null, null],
    [0, cup],
    [0, gram],
  ])("%s with %o renders nothing", (quantity, u) => {
    expect(formatQuantity(quantity, u)).toBe("");
  });

  test("non-finite renders nothing", () => {
    expect(formatQuantity(Number.NaN, cup)).toBe("");
    expect(formatQuantity(Number.POSITIVE_INFINITY, gram)).toBe("");
  });
});

describe("formatUnit", () => {
  test.each([
    // abbreviation wins when flagged and present, never pluralised
    [1, gram, "g"],
    [250, gram, "g"],
    [0.5, tbsp, "tbsp"],
    [2, tbsp, "tbsp"],
    [null, litre, "l"],
    // plural above 1 or at 0 / null
    [2, cup, "cups"],
    [1.5, cup, "cups"],
    [1.02, cup, "cups"], // display rounds to "1" but the quantity is above 1
    [0, cup, "cups"],
    [null, cup, "cups"],
    [3, pinch, "pinches"],
    [2, decimalWithPlural, "bottles"],
    // singular at exactly 1 and below 1
    [1, cup, "cup"],
    [0.5, cup, "cup"],
    [0.25, pinch, "pinch"],
    [0.5, decimalWithPlural, "bottle"],
    // fall back to the name
    [2, noPlural, "dash"],
    [1, noPlural, "dash"],
    [null, noPlural, "dash"],
    [2, abbreviationFlagNoText, "each"], // flag set, abbreviation empty: use the name/plural
    [1, abbreviationFlagNoText, "each"],
    // no unit
    [2, null, ""],
    [null, null, ""],
  ])("%s x %o -> %s", (quantity, u, expected) => {
    expect(formatUnit(quantity, u)).toBe(expected);
  });
});

describe("formatAmount", () => {
  test.each([
    [1.5, cup, "1½ cups"],
    [0.5, cup, "½ cup"],
    [1, cup, "1 cup"],
    [2, cup, "2 cups"],
    [0.33, cup, "⅓ cup"],
    [250, gram, "250 g"],
    [1.5, gram, "1.5 g"],
    [0.5, litre, "0.5 l"],
    [2, tbsp, "2 tbsp"],
    [0.25, tbsp, "¼ tbsp"],
    [3, pinch, "3 pinches"],
    [1, pinch, "1 pinch"],
    [2, noPlural, "2 dash"],
    [3, null, "3"],
    [1.5, null, "1.5"],
    [null, cup, "cups"], // "to taste": unit only
    [null, gram, "g"],
    [0, cup, "cups"],
    [null, null, ""],
    [0, null, ""],
  ])("%s x %o -> %s", (quantity, u, expected) => {
    expect(formatAmount(quantity, u)).toBe(expected);
  });
});

describe("formatDuration", () => {
  test.each([
    [null, ""],
    [0, ""],
    [0.2, ""], // rounds to nothing
    [Number.NaN, ""],
    [5, "5 min"],
    [45, "45 min"],
    [60, "1 hr"],
    [90, "1 hr 30 min"],
    [120, "2 hr"],
    [135, "2 hr 15 min"],
    [1500, "25 hr"], // a long ferment stays in hours; no day unit
  ])("%s -> %s", (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe("totalMinutes", () => {
  test("adds prep and cook, treating a missing side as 0, and is null when both are missing", () => {
    expect(totalMinutes(15, 30)).toBe(45);
    expect(totalMinutes(15, null)).toBe(15);
    expect(totalMinutes(null, 30)).toBe(30);
    expect(totalMinutes(0, 0)).toBe(0);
    expect(totalMinutes(null, null)).toBeNull();
  });
});

describe("formatYield", () => {
  const loaf = unit({ name: "loaf", pluralName: "loaves", abbreviation: "" });
  test.each([
    [12, null, "muffins", "12 muffins"],
    [4, null, "", "4"],
    [0, null, "a big pot", "a big pot"],
    [2, loaf, "", "2 loaves"],
    [1, loaf, "sourdough", "1 loaf sourdough"],
    [1.5, gram, "  ", "1.5 g"],
    [0, null, "", ""],
  ])("%s %o %s -> %s", (quantity, u, text, expected) => {
    expect(formatYield(quantity, u, text)).toBe(expected);
  });
});
