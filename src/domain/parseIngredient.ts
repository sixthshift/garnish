// One ingredient line, end to end: the parser decisions.md row 47 describes.
// Pure: no IO, importable by the client. Composes `parseQuantity.ts`,
// `parseUnit.ts` and `parseFood.ts` in that order, which is the order the
// pieces appear in a written line: amount, unit, food, note.
//
// `format.ts`'s `formatIngredient` is the exact inverse, and the round-trip
// test in `test/domain/parseIngredient.test.ts` holds the two together over the
// whole seed corpus.
//
// Nothing here invents an id or creates a row. A slot that matched carries the
// vocabulary row itself; a slot that missed carries the text it could not
// resolve, and what to do about that — create the food, pick an existing one,
// leave the line text-only — is the caller's (M17.5, M17.6). The two text
// fields are not quite symmetric, because the two slots fail differently:
//   - `foodText` is whatever of the food candidate no row accounts for: the
//     whole of it on a miss, empty on a full match. `parseFood` reads the
//     remainder of the line, so a miss there always has text to report.
//   - `unitText` is the unit word the line used. On a match it echoes the text
//     as written ("tbsp", "cups"), so a review sheet can show what was
//     consumed. A miss normally leaves it empty, because an unmatched token is
//     handed straight on to the food rather than held back — with one
//     exception below.
//
// The exception is the backtrack. When a line has an amount but neither the
// unit nor the food matched, the word sitting in the unit's position is tried
// as a unit anyway: "2 sprigs rosemary" against a vocabulary holding rosemary
// but no "sprig" parses the food as rosemary and reports `unitText: "sprigs"`.
// The retry only stands if it produces a food match, so a plain adjective is
// never promoted to a unit unless dropping it is what made the line readable.
// It is a proposal for the review step, never a row.
//
// Two smaller rules:
//   - a line with no amount does not give its whole remainder to the unit.
//     "pinch" on its own is a food-less line, not a unit with nothing to
//     measure, and Mealie drops the unit of an amount-less line on the way out
//     too (see `formatIngredient`).
//   - `originalText` is the line as given, trimmed and otherwise untouched:
//     the `=`, the note and the amount all stay in it, so a row can be stored
//     verbatim whatever the parse made of it.
import { parseFood, type FoodCandidate } from "./parseFood";
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
export function parseIngredient<U extends UnitCandidate, F extends FoodCandidate>(
  line: string,
  vocabulary: Vocabulary<U, F>,
): ParsedIngredient<U, F> {
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
