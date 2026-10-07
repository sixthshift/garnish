import type { Food, Unit } from "../reference";

/** The unit fields display needs. A full `Unit` satisfies it. */
export type DisplayUnit = Pick<Unit, "name" | "pluralName" | "abbreviation" | "useAbbreviation" | "fraction" | "portion">;

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

/**
 * The line's words, inflected and not yet joined. `raw` is a row with no food
 * whose original text stands in for the whole line; otherwise each piece is
 * its final display text, "" when the row has none.
 */
export type IngredientTokens = { raw: false; quantity: string; unit: string; food: string; note: string } | { raw: true; text: string };

/**
 * An ingredient as display tokens, with the food agreeing in number with what
 * measures it: "1 lemon", "2 lemons", "1 cup blueberries", "2 slices lemon".
 * `formatIngredient` is these tokens joined; a consumer that styles the pieces
 * apart takes them from here. Builds from a row, not from a line: parsing is
 * `parseIngredient`. Pure.
 */
export function inflectIngredient(ingredient: DisplayIngredient): IngredientTokens {
  const { quantity, unit, food, note, originalText } = ingredient;
  if (food === null && originalText.trim() !== "") return { raw: true, text: originalText.trim() };

  const hasQuantity = quantity !== null && quantity !== 0;
  return {
    raw: false,
    quantity: formatQuantity(quantity, unit),
    unit: hasQuantity ? formatUnit(quantity, unit) : "",
    food: formatFood(quantity, hasQuantity ? unit : null, food),
    note: note.trim(),
  };
}

/**
 * One ingredient line: "1½ cups flour, sifted", "2 eggs", "salt, to taste".
 * `inflectIngredient`'s tokens joined: no food but an originalText gives the
 * originalText verbatim; no quantity skips the unit. Nothing to show: "".
 */
export function formatIngredient(ingredient: DisplayIngredient): string {
  const tokens = inflectIngredient(ingredient);
  if (tokens.raw) return tokens.text;
  const head = [tokens.quantity, tokens.unit, tokens.food].filter((part) => part !== "").join(" ");
  return [head, tokens.note].filter((part) => part !== "").join(", ");
}

/**
 * Food label, agreeing in number with what measures it. A measure (cup,
 * gram, can, bunch) takes the plural whatever the amount: "1 cup
 * blueberries". A portion unit (slice, piece) cuts one item, so the food
 * stays singular: "2 slices lemon". A bare count is singular at 1 or below
 * and plural above: "½ lemon", "2 lemons"; no amount at all reads as plural.
 * The name when the food has no plural. Empty for no food.
 */
function formatFood(quantity: number | null, unit: DisplayUnit | null, food: DisplayFood | null): string {
  if (food === null) return "";
  const plural = unit !== null ? !unit.portion : quantity === null || quantity === 0 || quantity > 1;
  if (plural && food.pluralName !== null && food.pluralName.trim() !== "") return food.pluralName;
  return food.name;
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

/** "serves", "servings", "people": the words that make a yield a head count. */
const SERVING_WORD = /^(?:serves?|servings?|people|persons?)$/i;

/**
 * The yield as the header reads it: a label and the value after it. A head
 * count reads "Serves 6", whichever way it was written ("6 serves",
 * "6 servings", "serves 6", a quantity in a "serving" unit); anything else is
 * "Makes" and `formatYield`'s line, "Makes 8 slices". The value is empty when
 * nothing is recorded.
 */
export function yieldLine(quantity: number, unit: DisplayUnit | null, text: string): { label: "Serves" | "Makes"; value: string } {
  const words = text.trim();
  const count = formatQuantity(quantity, unit);
  if (count !== "" && words === "" && unit !== null && SERVING_WORD.test(unit.name)) return { label: "Serves", value: count };
  if (count !== "" && unit === null && SERVING_WORD.test(words)) return { label: "Serves", value: count };
  if (count === "") {
    // Only the text: "serves 6", "6 servings", "serves 4-6".
    const leading = /^serves\s+(.+)$/i.exec(words)?.[1];
    if (leading !== undefined) return { label: "Serves", value: leading };
    const [, number, noun] = /^(\S+)\s+(\S+)$/.exec(words) ?? [];
    if (number !== undefined && noun !== undefined && SERVING_WORD.test(noun)) return { label: "Serves", value: number };
  }
  return { label: "Makes", value: formatYield(quantity, unit, text) };
}
