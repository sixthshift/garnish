// Quantity and unit display. Pure: no IO, importable by the client.
//
// Follows Mealie's ingredient display rules (frontend/composables/recipes/
// use-recipe-ingredients.ts), with unicode vulgar fractions in place of its
// <sup>/<sub> markup:
//   - unit.fraction true:  mixed number with the nearest vulgar fraction that
//                          has a glyph (denominators 2..10). 1.5 -> "1½",
//                          0.33 -> "⅓", 2.999 -> "3".
//   - otherwise, or no unit: decimals to 2 places, trailing zeros trimmed.
//                          1.5 -> "1.5", 2 -> "2", 0.125 -> "0.13".
//   - null or 0 quantity renders no number (Mealie hides a zero amount).
//   - unit label: abbreviation when useAbbreviation is set and one exists
//     (never pluralised: "g", "ml", "tbsp"); else the plural when the quantity
//     is above 1 or is 0 and a plural exists ("2 cups", "½ cup", "cups" for an
//     unquantified ingredient); else the name.
import type { Unit } from "./recipe";

/** The unit fields display needs. A full `Unit` satisfies it. */
export type DisplayUnit = Pick<Unit, "name" | "pluralName" | "abbreviation" | "useAbbreviation" | "fraction">;

/** Vulgar fractions with a single unicode glyph, ascending by value. */
const VULGAR_FRACTIONS: ReadonlyArray<readonly [value: number, glyph: string]> = [
  [1 / 10, "⅒"],
  [1 / 9, "⅑"],
  [1 / 8, "⅛"],
  [1 / 7, "⅐"],
  [1 / 6, "⅙"],
  [1 / 5, "⅕"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [2 / 5, "⅖"],
  [1 / 2, "½"],
  [3 / 5, "⅗"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [4 / 5, "⅘"],
  [5 / 6, "⅚"],
  [7 / 8, "⅞"],
];

/** Number text for an ingredient amount: "1½", "0.75", "2". Empty for null or 0. */
export function formatQuantity(quantity: number | null, unit: DisplayUnit | null = null): string {
  if (quantity === null || !Number.isFinite(quantity) || quantity === 0) return "";
  return unit?.fraction ? formatFraction(quantity) : formatDecimal(quantity);
}

/** Unit label for an amount: abbreviation, plural or name per the unit's flags. Empty for no unit. */
export function formatUnit(quantity: number | null, unit: DisplayUnit | null): string {
  if (unit === null) return "";
  if (unit.useAbbreviation && unit.abbreviation.trim() !== "") return unit.abbreviation;
  const plural = quantity === null || quantity === 0 || quantity > 1;
  if (plural && unit.pluralName !== null && unit.pluralName.trim() !== "") return unit.pluralName;
  return unit.name;
}

/** "1½ cups", "250 g", "cups", "3". Quantity and unit joined by a space; empty when both are empty. */
export function formatAmount(quantity: number | null, unit: DisplayUnit | null): string {
  return [formatQuantity(quantity, unit), formatUnit(quantity, unit)].filter((part) => part !== "").join(" ");
}

/** Decimals to 2 places with trailing zeros trimmed: 1.5 -> "1.5", 2 -> "2", 0.125 -> "0.13". */
function formatDecimal(quantity: number): string {
  return Number(quantity.toFixed(2)).toString();
}

/**
 * Mixed number with a vulgar fraction glyph: 1.5 -> "1½", 0.33 -> "⅓", 2.96 -> "3".
 * The fractional part snaps to the nearest glyph, or to 0 or 1 when those are
 * closer. A positive amount too small to reach any glyph (0.02) falls back to
 * decimals rather than vanishing.
 */
function formatFraction(quantity: number): string {
  let whole = Math.floor(quantity);
  const remainder = quantity - whole;

  let glyph = "";
  let nearest = remainder; // distance to 0
  if (1 - remainder < nearest) {
    nearest = 1 - remainder;
    whole += 1;
  }
  for (const [value, candidate] of VULGAR_FRACTIONS) {
    const distance = Math.abs(remainder - value);
    if (distance < nearest) {
      nearest = distance;
      glyph = candidate;
      whole = Math.floor(quantity);
    }
  }

  if (whole === 0 && glyph === "") return formatDecimal(quantity);
  return `${whole === 0 ? "" : whole}${glyph}`;
}
