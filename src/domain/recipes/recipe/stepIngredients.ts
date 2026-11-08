// Which of a recipe's ingredients a step names, computed from its text at word boundaries, longest name first; nothing is stored.

import type { Food } from "../reference";
import type { Step } from "./recipe";

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

export type IngredientLike = { id: string; food: FoodLike | null };
type StepLike = Pick<Step, "id" | "text" | "ingredientIds">;

/**
 * A part's steps with links filled in: every step with no links gets the ids
 * of the ingredients `ingredientsInStep` finds in its text, from its own part
 * first and then from `elsewhere`, the recipe's other parts' rows (decisions.md
 * row 228). A food listed in both goes to the step's own part, since ties go
 * to the earlier row. A step that already links something is returned
 * unchanged. Pure.
 *
 * Loosely typed over `id`, `food`, `text` and `ingredientIds` so both a
 * saved `Part` and an editor `DraftPart` fit; the draft must give every row
 * an id before calling this, since a link needs one to name.
 */
export function suggestLinks<I extends IngredientLike, S extends StepLike>(
  part: { ingredients: readonly I[]; steps: readonly S[] },
  elsewhere: readonly IngredientLike[] = []
): S[] {
  const rows: readonly IngredientLike[] = [...part.ingredients, ...elsewhere];
  return part.steps.map((step) => {
    if (step.ingredientIds.length > 0) return step;
    const matches = ingredientsInStep(step.text, rows);
    return matches.length === 0 ? step : { ...step, ingredientIds: matches.map((ingredient) => ingredient.id) };
  });
}

/** Every part's rows but part `index`'s, in recipe order: what a step of that part may link besides its own. Pure. */
export function rowsElsewhere<I>(parts: readonly { ingredients: readonly I[] }[], index: number): I[] {
  return parts.flatMap((part, i) => (i === index ? [] : part.ingredients));
}
