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

  const unit = takesUnit ? matched.unit : null;
  let unitText = takesUnit ? consumed(head, matched.rest) : "";
  const afterUnit = takesUnit ? matched.rest : head;

  const parsed = parseFood(afterUnit, vocabulary.foods);
  let food = parsed.food;
  let foodText = parsed.foodText;

  // The backtrack: an amount, no unit and no food means the word in the unit's
  // position may be a unit this vocabulary lacks. Only kept if dropping it
  // makes the rest a food.
  if (quantity !== null && unit === null && food === null) {
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

  return { quantity, fixed, unit, unitText, food, foodText, note: parsed.note, originalText };
}

/** The text of `head` that a matcher consumed, given the `rest` it left behind. */
function consumed(head: string, rest: string): string {
  if (rest === "") return head.trim();
  return head.endsWith(rest) ? head.slice(0, head.length - rest.length).trim() : "";
}
