// One ingredient line end to end: parseQuantity, then parseUnit, then parseFood; nothing here invents an id or creates a row.

import { type FoodCandidate, parseFood } from "./parseFood";
import { parseQuantity } from "./parseQuantity";
import { parseUnit, type UnitCandidate } from "./parseUnit";

/** The vocabulary a line is read against: the `unit` and `food` tables, or any subset of them. */
export type Vocabulary<U extends UnitCandidate, F extends FoodCandidate> = {
  units: readonly U[];
  foods: readonly F[];
};

/** What one ingredient line parses to. `unit`/`food` are null when the vocabulary has no match. */
export type ParsedIngredient<U extends UnitCandidate, F extends FoodCandidate> = {
  quantity: number | null;
  fixed: boolean;
  unit: U | null;
  unitText: string;
  food: F | null;
  foodText: string;
  note: string;
  originalText: string;
};

/**
 * One ingredient line: `{ quantity, fixed, unit, unitText, food, foodText, note, originalText }`.
 * Pure and non-destructive — a slot that cannot be resolved reports its text
 * and leaves the decision to the caller.
 */
export function parseIngredient<U extends UnitCandidate, F extends FoodCandidate>(line: string, vocabulary: Vocabulary<U, F>): ParsedIngredient<U, F> {
  const originalText = line.trim();
  const { quantity, fixed, rest } = parseQuantity(originalText);

  const head = rest.trim();
  const matched = parseUnit(head, vocabulary.units);
  // An amount-less line keeps its last word for the food rather than spending
  // it on a unit that would have nothing to measure.
  const takesUnit = matched.unit !== null && (quantity !== null || matched.rest.trim() !== "");

  let amount = quantity;
  let unit = takesUnit ? matched.unit : null;
  let unitText = takesUnit ? consumed(head, matched.rest) : "";
  // "2 cloves of garlic": the "of" joins the unit to the food and is neither.
  // Only after a unit, so a food whose name starts with the word keeps it.
  const afterAmount = takesUnit ? matched.rest : head;
  // "250g / 8oz green beans": the same amount in a second unit, as "500g (1 lb)" is in brackets,
  // goes to the note the way the bracketed one does.
  const alternative = quantity !== null && unit !== null ? alternativeAmount(afterAmount, vocabulary.units) : null;
  let twin = alternative?.text ?? "";
  // The metric one is the amount and the imperial one the note, in whichever order the page wrote them.
  if (alternative && unit && IMPERIAL.has(unit.name.toLowerCase()) && !IMPERIAL.has(alternative.unit.name.toLowerCase())) {
    twin = originalText.endsWith(afterAmount)
      ? originalText
          .slice(0, originalText.length - afterAmount.length)
          .replace(/^=/, "")
          .trim()
      : "";
    amount = alternative.quantity;
    unit = alternative.unit;
    unitText = alternative.unitText;
  }
  const afterUnit = (alternative?.rest ?? afterAmount).replace(/^\s*of\s+/i, "");

  const parsed = parseFood(afterUnit, vocabulary.foods);
  let food = parsed.food;
  let foodText = parsed.foodText;

  // The backtrack: an amount, no unit and no food means the word in the unit's
  // position may be a unit this vocabulary lacks. Only kept if dropping it
  // makes the rest a food.
  if (amount !== null && unit === null && food === null) {
    const words = foodText.split(/\s+/).filter((word) => word !== "");
    if (words.length > 1) {
      const retry = parseFood(words.slice(1).join(" "), vocabulary.foods);
      if (retry.food !== null) {
        unitText = words[0]!;
        food = retry.food;
        foodText = retry.foodText;
      }
    }
  }

  const note = [twin, parsed.note].filter((part) => part !== "").join(", ");
  return { quantity: amount, fixed, unit, unitText, food, foodText, note, originalText };
}

/** The seeded imperial units, by name: beside a metric twin, the twin is the amount (benchmark rule "Two amounts"). */
const IMPERIAL: ReadonlySet<string> = new Set(["ounce", "pound", "fluid ounce", "pint", "quart", "gallon"]);

/**
 * A second amount after a slash — "/ 8oz", "/250 ml" — as its text and the line
 * after it. Null unless the slash is followed by an amount and a unit the
 * vocabulary has, so "salt/pepper" and a food's own slash are left alone.
 */
function alternativeAmount<U extends UnitCandidate>(
  text: string,
  units: readonly U[]
): { quantity: number; unit: U; unitText: string; text: string; rest: string } | null {
  const slash = /^\s*\/\s*/.exec(text);
  if (slash === null) return null;
  const after = text.slice(slash[0].length);
  const { quantity, rest } = parseQuantity(after);
  if (quantity === null) return null;
  const matched = parseUnit(rest.trim(), units);
  if (matched.unit === null || matched.rest.trim() === "") return null;
  const taken = after.slice(0, after.length - matched.rest.length).trim();
  return { quantity, unit: matched.unit, unitText: consumed(rest.trim(), matched.rest), text: taken, rest: matched.rest };
}

/** The text of `head` that a matcher consumed, given the `rest` it left behind. */
function consumed(head: string, rest: string): string {
  if (rest === "") return head.trim();
  return head.endsWith(rest) ? head.slice(0, head.length - rest.length).trim() : "";
}
