// Editing a part's ingredient rows.
import { formatIngredient } from "../ingredient";
import { randomUuid } from "../ids";
import { unlinkIngredient } from "./links";
import { type DraftIngredient, type RecipeDraft } from "./types";
import { type Recipe } from "../recipe";
import { draftFromRecipe } from "./draft";

/** A blank structured row with a fresh id, so it has a stable key before it is saved. */
export function newIngredient(): DraftIngredient {
  return { id: randomUuid(), quantity: null, unit: null, food: null, note: "", originalText: "", fixed: false };
}

/** A row is text only when it has no food and some original text. Pure. */
export function isTextOnly(ingredient: DraftIngredient): boolean {
  return !ingredient.food && (ingredient.originalText ?? "").trim() !== "";
}

export function withIngredients(draft: RecipeDraft, pi: number, ingredients: DraftIngredient[]): RecipeDraft {
  return { ...draft, parts: draft.parts.map((part, i) => (i === pi ? { ...part, ingredients } : part)) };
}

export function inRange(draft: RecipeDraft, pi: number, ii?: number): boolean {
  const part = draft.parts[pi];
  if (pi < 0 || !part) return false;
  return ii === undefined || (ii >= 0 && ii < part.ingredients.length);
}

/** The draft with a blank row appended to part `pi`. An out-of-range `pi` returns a copy unchanged. Pure apart from the row's id. */
export function addIngredient(draft: RecipeDraft, pi: number): RecipeDraft {
  if (!inRange(draft, pi)) return { ...draft, parts: draft.parts.slice() };
  return withIngredients(draft, pi, [...draft.parts[pi]!.ingredients, newIngredient()]);
}

/** The draft with `patch` merged into row `ii` of part `pi`. Out-of-range indices return a copy unchanged. Pure. */
export function updateIngredient(draft: RecipeDraft, pi: number, ii: number, patch: Partial<DraftIngredient>): RecipeDraft {
  if (!inRange(draft, pi, ii)) return { ...draft, parts: draft.parts.slice() };
  const ingredients = draft.parts[pi]!.ingredients.map((row, i) => (i === ii ? { ...row, ...patch } : row));
  return withIngredients(draft, pi, ingredients);
}

/**
 * The draft with part `pi`'s steps no longer linking `ingredientId`. A link
 * never crosses a part, so a row that leaves a part — deleted, or moved
 * elsewhere — goes out of that part's step links too, in the draft, before
 * save (M28.3). An id-less row (never saved, never linked) is a no-op. Pure.
 */
export function withoutLinks(draft: RecipeDraft, pi: number, ingredientId: string | undefined): RecipeDraft {
  if (ingredientId === undefined) return draft;
  return { ...draft, parts: draft.parts.map((part, i) => (i === pi ? unlinkIngredient(part, ingredientId) : part)) };
}

/** The draft without row `ii` of part `pi`, and without its links in that part's steps. Out-of-range indices return a copy unchanged. Pure. */
export function removeIngredient(draft: RecipeDraft, pi: number, ii: number): RecipeDraft {
  if (!inRange(draft, pi, ii)) return { ...draft, parts: draft.parts.slice() };
  const row = draft.parts[pi]!.ingredients[ii]!;
  return withoutLinks(
    withIngredients(
      draft,
      pi,
      draft.parts[pi]!.ingredients.filter((_, i) => i !== ii),
    ),
    pi,
    row.id,
  );
}

/**
 * The draft with row `ii` of part `fromPi` inserted into part `toPi`
 * at `toIndex`, and out of the step links of the part it left, which is clamped to that part's length — so the default,
 * `Infinity`, appends. The same part, or an out-of-range index, returns a
 * copy unchanged. Pure.
 */
export function moveIngredientTo(draft: RecipeDraft, fromPi: number, ii: number, toPi: number, toIndex = Number.POSITIVE_INFINITY): RecipeDraft {
  if (fromPi === toPi || !inRange(draft, fromPi, ii) || !inRange(draft, toPi)) return { ...draft, parts: draft.parts.slice() };
  const row = draft.parts[fromPi]!.ingredients[ii]!;
  const target = draft.parts[toPi]!.ingredients;
  const at = Math.max(0, Math.min(Number.isFinite(toIndex) ? toIndex : target.length, target.length));
  const moved: RecipeDraft = {
    ...draft,
    parts: draft.parts.map((part, i) => {
      if (i === fromPi) return { ...part, ingredients: part.ingredients.filter((_, j) => j !== ii) };
      if (i === toPi) return { ...part, ingredients: [...target.slice(0, at), row, ...target.slice(at)] };
      return part;
    }),
  };
  // The row is another part's now, and a link never crosses a part: the part
  // it left forgets it. The part it joined links nothing to it yet (M28.3).
  return withoutLinks(moved, fromPi, row.id);
}

/**
 * The draft with row `ii` of part `fromPi` appended to part `toPi`.
 * What the "Move to" select does. Pure.
 */
export function moveIngredient(draft: RecipeDraft, fromPi: number, ii: number, toPi: number): RecipeDraft {
  return moveIngredientTo(draft, fromPi, ii, toPi);
}

/** The row patch that switches modes: to text only clears amount and food; back to structured clears the raw line. Pure. */
export function textOnlyPatch(textOnly: boolean): Partial<DraftIngredient> {
  return textOnly ? { quantity: null, unit: null, food: null, fixed: false } : { originalText: "" };
}

/** The summary line a phone row shows: the formatted ingredient, or the raw line for a text-only row. Blank for an empty row. Pure. */
export function ingredientSummary(ingredient: DraftIngredient): string {
  const unit = ingredient.unit ?? null;
  const food = ingredient.food ?? null;
  return formatIngredient({
    quantity: ingredient.quantity ?? null,
    unit:
      unit === null
        ? null
        : {
            name: unit.name,
            pluralName: unit.pluralName ?? null,
            abbreviation: unit.abbreviation ?? "",
            useAbbreviation: unit.useAbbreviation ?? false,
            fraction: unit.fraction ?? true,
          },
    food: food === null ? null : { name: food.name, pluralName: food.pluralName ?? null },
    note: ingredient.note ?? "",
    originalText: ingredient.originalText ?? "",
  });
}

/**
 * The stored recipe as a draft with one ingredient replaced: part `partId`'s
 * `ingredientId` becomes `next`, keeping its place in the list. Every other
 * row, and every id in the document, comes across untouched — the ticks in
 * `sessionStorage` are keyed by those ids. An unknown part or ingredient
 * returns the document unchanged. Pure.
 */
export function withIngredientReplaced(recipe: Recipe, partId: string, ingredientId: string, next: DraftIngredient): RecipeDraft {
  const draft = draftFromRecipe(recipe);
  return {
    ...draft,
    parts: draft.parts.map((part) =>
      part.id !== partId
        ? part
        : {
            ...part,
            ingredients: part.ingredients.map((ingredient) => (ingredient.id === ingredientId ? { ...next, id: ingredient.id } : ingredient)),
          },
    ),
  };
}
