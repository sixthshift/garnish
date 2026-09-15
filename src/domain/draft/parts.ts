// Editing a draft's parts.

import { randomUuid } from "../../lib/id";
import { moveItem } from "../../lib/lists";
import { formatIngredient } from "../ingredient";
import { ingredientInputSchema } from "../recipe";
import type { DraftIngredient, DraftPart, RecipeDraft } from "./types";

/** A blank part with a fresh id, so it has a stable row key before it is saved. */
export function newPart(name = ""): DraftPart {
  return { id: randomUuid(), name, ingredients: [], steps: [] };
}

/** The draft with a blank part appended. Pure apart from the new part's random id. */
export function addPart(draft: RecipeDraft, name = ""): RecipeDraft {
  return { ...draft, parts: [...draft.parts, newPart(name)] };
}

/** The draft with part `index` renamed. An out-of-range index returns a copy unchanged. Pure. */
export function renamePart(draft: RecipeDraft, index: number, name: string): RecipeDraft {
  return {
    ...draft,
    parts: draft.parts.map((part, i) => (i === index ? { ...part, name } : part)),
  };
}

/**
 * The draft without part `index`. Refuses to remove the last part (a recipe
 * needs at least one) and ignores an out-of-range index; both return a copy
 * unchanged. Pure.
 */
export function removePart(draft: RecipeDraft, index: number): RecipeDraft {
  if (draft.parts.length <= 1 || index < 0 || index >= draft.parts.length) {
    return { ...draft, parts: draft.parts.slice() };
  }
  return { ...draft, parts: draft.parts.filter((_, i) => i !== index) };
}

/** The draft with part `from` moved to `to`. Same rules as `moveItem`. Pure. */
export function movePart(draft: RecipeDraft, from: number, to: number): RecipeDraft {
  return { ...draft, parts: moveItem(draft.parts, from, to) };
}

/** Whether removing the part would take ingredients or steps with it. Pure. */
export function hasContent(part: DraftPart): boolean {
  return part.ingredients.length > 0 || part.steps.length > 0;
}

/**
 * One ingredient line for a draft row. Draft ingredients are the input shape
 * (fields optional), so the schema fills defaults first; a row the schema
 * rejects (a negative quantity mid-edit) falls back to its raw text. Pure.
 */
export function ingredientLine(ingredient: DraftIngredient): string {
  const parsed = ingredientInputSchema.safeParse(ingredient);
  if (parsed.success) return formatIngredient(parsed.data);
  return (ingredient.originalText ?? "").trim() || (ingredient.note ?? "").trim();
}

/**
 * Is this draft a flat recipe — one part, unnamed? Then the part is not a part
 * anyone chose, it is just the recipe (decisions.md rows 49 and 53), and the
 * editor prints its two lists without a name field, a card or a reorder
 * handle, exactly as the view page prints it without a heading. Pure.
 */
export function isBare(draft: RecipeDraft): boolean {
  return draft.parts.length === 1 && (draft.parts[0]!.name ?? "").trim() === "";
}
