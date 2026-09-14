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
//   - ingredient line: amount, food, note. Mealie's useParsedIngredientText:
//     the unit is dropped when there is no quantity ("salt, to taste", not
//     "tsp salt"); the food takes its plural when the quantity is null, 0 or
//     above 1 and a plural exists, whether or not a unit is present ("2 eggs",
//     "2 cups eggs"). Divergences, both because this returns plain text where
//     Mealie returns markup: the note follows a comma (Mealie separates it with
//     a styled span, and its parser strips that comma on the way in), and a
//     line whose food is null falls back to `originalText` verbatim when there
//     is one (Mealie never renders originalText; its disable-amounts path,
//     which shows the raw line alone, is the closest analogue). The raw line
//     already carries its own amount and note, so neither is prefixed.
import type { Food, Unit } from "../recipe/recipe";

/** The unit fields display needs. A full `Unit` satisfies it. */
export type DisplayUnit = Pick<Unit, "name" | "pluralName" | "abbreviation" | "useAbbreviation" | "fraction">;

/** The food fields display needs. A full `Food` satisfies it. */
export type DisplayFood = Pick<Food, "name" | "pluralName">;

/** The ingredient fields display needs. A full `Ingredient` satisfies it. */
export type DisplayIngredient = {
  quantity: number | null;
  unit: DisplayUnit | null;
  food: DisplayFood | null;
  note: string;
  originalText: string;
};

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

/** Food label: plural when the quantity is null, 0 or above 1 and a plural exists; else the name. Empty for no food. */
export function formatFood(quantity: number | null, food: DisplayFood | null): string {
  if (food === null) return "";
  const plural = quantity === null || quantity === 0 || quantity > 1;
  if (plural && food.pluralName !== null && food.pluralName.trim() !== "") return food.pluralName;
  return food.name;
}

/**
 * One ingredient line: "1½ cups flour, sifted", "2 eggs", "salt, to taste".
 * No food but an originalText: the originalText verbatim. No quantity: the
 * unit is skipped. Nothing to show: "".
 */
export function formatIngredient(ingredient: DisplayIngredient): string {
  const { quantity, unit, food, note, originalText } = ingredient;
  if (food === null && originalText.trim() !== "") return originalText.trim();

  const hasQuantity = quantity !== null && quantity !== 0;
  const head = [hasQuantity ? formatAmount(quantity, unit) : "", formatFood(quantity, food)]
    .filter((part) => part !== "")
    .join(" ");
  return [head, note.trim()].filter((part) => part !== "").join(", ");
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

// --- Recipe header display ---------------------------------------------------

/**
 * Minutes as a readable duration: 45 -> "45 min", 90 -> "1 hr 30 min",
 * 120 -> "2 hr". Empty for null, 0 or a non-finite value (nothing recorded).
 */
export function formatDuration(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes) || minutes <= 0) return "";
  const whole = Math.round(minutes);
  if (whole === 0) return "";
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** Prep plus cook time when either is recorded; null when neither is. */
export function totalMinutes(prepTime: number | null, performTime: number | null): number | null {
  if (prepTime === null && performTime === null) return null;
  return (prepTime ?? 0) + (performTime ?? 0);
}

/**
 * Yield line, Mealie's order: the scaled quantity (with its unit when there is
 * one) then the free text. "12 muffins", "4 flatbreads", "1 loaf" or just the
 * text when the quantity is 0. Empty when nothing is recorded.
 */
export function formatYield(quantity: number, unit: DisplayUnit | null, text: string): string {
  return [formatAmount(quantity, unit), text.trim()].filter((part) => part !== "").join(" ");
}
