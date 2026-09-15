import type { UnitInput } from "../models/unit/repo";

/** Default units, en-AU spelling. Fraction off for weights and volumes measured on a scale or jug. */
export const DEFAULT_UNITS: readonly UnitInput[] = [
  // metric
  { name: "gram", pluralName: "grams", abbreviation: "g", useAbbreviation: true, fraction: false },
  { name: "kilogram", pluralName: "kilograms", abbreviation: "kg", useAbbreviation: true, fraction: false },
  { name: "millilitre", pluralName: "millilitres", abbreviation: "ml", useAbbreviation: true, fraction: false },
  { name: "litre", pluralName: "litres", abbreviation: "l", useAbbreviation: true, fraction: false },
  // kitchen measures
  { name: "teaspoon", pluralName: "teaspoons", abbreviation: "tsp", useAbbreviation: true, fraction: true },
  { name: "tablespoon", pluralName: "tablespoons", abbreviation: "tbsp", useAbbreviation: true, fraction: true },
  { name: "cup", pluralName: "cups", abbreviation: "cup", useAbbreviation: false, fraction: true },
  // imperial
  { name: "ounce", pluralName: "ounces", abbreviation: "oz", useAbbreviation: true, fraction: false },
  { name: "pound", pluralName: "pounds", abbreviation: "lb", useAbbreviation: true, fraction: false },
  // counts
  { name: "pinch", pluralName: "pinches", abbreviation: "pinch", useAbbreviation: false, fraction: true },
  { name: "piece", pluralName: "pieces", abbreviation: "pc", useAbbreviation: false, fraction: true },
  { name: "slice", pluralName: "slices", abbreviation: "slice", useAbbreviation: false, fraction: true },
  { name: "clove", pluralName: "cloves", abbreviation: "clove", useAbbreviation: false, fraction: true },
  { name: "can", pluralName: "cans", abbreviation: "can", useAbbreviation: false, fraction: true },
  { name: "bunch", pluralName: "bunches", abbreviation: "bunch", useAbbreviation: false, fraction: true },
];
