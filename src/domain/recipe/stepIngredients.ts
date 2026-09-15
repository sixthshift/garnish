// Which of a part's ingredients a step mentions. Pure: no IO, importable by
// the client.
//
// Mealie stores step-to-ingredient links, set by hand in its editor
// (`RecipeStep.ingredientReferences`); decisions.md row 22 declined to store
// them, so this computes the match instead — nothing is written, nothing has
// to be kept in step with an edit. The rules are deliberately dull, because a
// wrong chip under a step is worse than a missing one:
//
//   - a food matches on its name, its plural name or any of its aliases,
//     case-insensitively,
//   - only at word boundaries, so "pear" does not match "spearmint",
//   - longest name first, and a matched span is consumed, so "brown sugar"
//     in the text does not also light up the "sugar" row,
//   - each ingredient at most once however many times it is named,
//   - results in the part's own list order, not the order they appear in the
//     text, so the chips read like the list above them.
//
// A text-only ingredient (`food === null`) has nothing to match on and is
// skipped: its `originalText` is a whole line, not a food name.
import type { Step } from "./recipe";
import type { Food } from "../reference";

/** Letters and digits: anything else counts as a word boundary. */
const WORD = /[\p{L}\p{N}]/u;

function isBoundary(character: string | undefined): boolean {
  return character === undefined || !WORD.test(character);
}

/**
 * The parts of `Food` the matcher reads. `pluralName` and `aliases` are
 * optional here (unlike on `Food` itself) so a draft row's food — built from
 * the write shape, where a defaulted field is optional — fits too.
 */
type FoodLike = Pick<Food, "name"> & Partial<Pick<Food, "pluralName" | "aliases">>;

/** Every name a food answers to, lowercased and trimmed, blanks dropped. Pure. */
export function foodNames(food: FoodLike): string[] {
  const names = [food.name, food.pluralName ?? "", ...(food.aliases ?? [])].map((name) => name.trim().toLowerCase());
  return [...new Set(names.filter((name) => name !== ""))];
}

type Candidate = { index: number; name: string };

/**
 * The ingredients of `ingredients` whose food is named in `text`, in list
 * order, each at most once. Pure.
 *
 * Typed over anything with a `food`, not just a full `Ingredient`, so a draft
 * row fits too.
 */
export function ingredientsInStep<I extends { food: FoodLike | null }>(text: string, ingredients: readonly I[]): I[] {
  const haystack = text.toLowerCase();
  if (haystack.trim() === "") return [];

  const candidates: Candidate[] = [];
  ingredients.forEach((ingredient, index) => {
    if (ingredient.food === null) return;
    for (const name of foodNames(ingredient.food)) candidates.push({ index, name });
  });
  // Longest first: the span a long name eats is closed to the short names
  // inside it. Ties go to the earlier ingredient, so the order is stable.
  candidates.sort((a, b) => b.name.length - a.name.length || a.index - b.index);

  const consumed = new Array<boolean>(haystack.length).fill(false);
  const hits = new Set<number>();

  for (const candidate of candidates) {
    if (hits.has(candidate.index)) continue;
    const at = findFree(haystack, candidate.name, consumed);
    if (at === -1) continue;
    hits.add(candidate.index);
    for (let i = at; i < at + candidate.name.length; i += 1) consumed[i] = true;
  }

  return ingredients.filter((_, index) => hits.has(index));
}

/** The first offset where `name` sits on word boundaries over unconsumed text, or -1. */
function findFree(haystack: string, name: string, consumed: boolean[]): number {
  for (let from = 0; from <= haystack.length - name.length; ) {
    const at = haystack.indexOf(name, from);
    if (at === -1) return -1;
    const end = at + name.length;
    if (isBoundary(haystack[at - 1]) && isBoundary(haystack[end]) && !isConsumed(consumed, at, end)) return at;
    from = at + 1;
  }
  return -1;
}

function isConsumed(consumed: boolean[], from: number, to: number): boolean {
  for (let i = from; i < to; i += 1) if (consumed[i]) return true;
  return false;
}

type IngredientLike = { id: string; food: FoodLike | null };
type StepLike = Pick<Step, "id" | "text" | "ingredientIds">;

/**
 * A part with `suggestLinks` filled in: every step with no links gets the
 * ids of the ingredients `ingredientsInStep` finds in its text, in the
 * part's ingredient order. A step that already links something is returned
 * unchanged. Pure.
 *
 * Loosely typed over `id`, `food`, `text` and `ingredientIds` so both a
 * saved `Part` and an editor `DraftPart` fit; the draft must give every row
 * an id before calling this, since a link needs one to name.
 */
export function suggestLinks<I extends IngredientLike, S extends StepLike>(part: {
  ingredients: readonly I[];
  steps: readonly S[];
}): S[] {
  return part.steps.map((step) => {
    if (step.ingredientIds.length > 0) return step;
    const matches = ingredientsInStep(step.text, part.ingredients);
    return matches.length === 0 ? step : { ...step, ingredientIds: matches.map((ingredient) => ingredient.id) };
  });
}
