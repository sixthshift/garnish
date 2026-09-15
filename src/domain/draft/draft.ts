// A draft from nothing, from a recipe, or from parsed input; and what it has in it.
import { type ParsedRecipeInput, type Recipe } from "../recipe";
import { randomUuid } from "../../lib/id";
import { newPart } from "./parts";
import { type RecipeDraft } from "./types";

/** A blank recipe with one unnamed, empty component: the least document that validates. Pure apart from the component's random id. */
export function emptyDraft(): RecipeDraft {
  return {
    name: "",
    description: "",
    image: null,
    rating: null,
    lastMade: null,
    recipeServings: 0,
    recipeYieldQuantity: 0,
    yieldUnit: null,
    recipeYield: "",
    prepTime: null,
    performTime: null,
    sourceUrl: null,
    favourite: false,
    notes: [],
    tags: [],
    parts: [newPart()],
  };
}

/**
 * The stored recipe as an editable draft: slug, timestamps and the restyle
 * stamp dropped (the server owns them), every id kept. `restyledAt` goes with
 * them because it is not in the write shape at all — only a restyle or a
 * restore moves it, so an edit must not carry it back (M37.5). Pure.
 */
export function draftFromRecipe(recipe: Recipe): RecipeDraft {
  const { slug: _slug, createdAt: _createdAt, updatedAt: _updatedAt, restyledAt: _restyledAt, ...rest } = recipe;
  return {
    ...rest,
    notes: rest.notes.map((note) => ({ ...note })),
    tags: rest.tags.map((tag) => ({ ...tag })),
    parts: rest.parts.map((part) => ({
      ...part,
      ingredients: part.ingredients.map((ingredient) => ({ ...ingredient })),
      steps: part.steps.map((step) => ({ ...step })),
    })),
  };
}

/** Structural equality over the JSON-shaped values a draft is made of. Key order is not a difference; array order is. */
export function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => same(item, b[index]));
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) if (!same(left[key], right[key])) return false;
  return true;
}

/**
 * Has the draft moved away from the one the form opened on? Compared by value,
 * so retyping a field back to what it was is not dirty, and reordering a list
 * is. A picked image file lives outside the draft; the form ors it in. Pure.
 */
export function isDirty(initial: RecipeDraft, draft: RecipeDraft): boolean {
  return !same(initial, draft);
}

/** A parsed document as a draft: every list present, every child given an id so the editor can key on it. Pure apart from the ids it fills in. */
export function draftFromInput(input: ParsedRecipeInput): RecipeDraft {
  return {
    ...input,
    notes: input.notes.map((note) => ({ ...note, id: note.id ?? randomUuid() })),
    tags: input.tags.map((tag) => ({ ...tag })),
    parts: input.parts.map((part) => ({
      ...part,
      id: part.id ?? randomUuid(),
      ingredients: part.ingredients.map((ingredient) => ({ ...ingredient, id: ingredient.id ?? randomUuid() })),
      steps: part.steps.map((step) => ({ ...step, id: step.id ?? randomUuid() })),
    })),
  };
}

/**
 * Does the draft have anything in the Details section — yield, times, tags or
 * a source? A new recipe has none of it, which is why the section opens
 * folded; an existing one usually has some, and a field you cannot see is a
 * field you will forget to change. Pure.
 */
export function hasDetails(draft: RecipeDraft): boolean {
  return (
    draft.recipeYieldQuantity > 0 ||
    draft.yieldUnit !== null ||
    draft.recipeYield.trim() !== "" ||
    draft.prepTime !== null ||
    draft.performTime !== null ||
    draft.tags.length > 0 ||
    (draft.sourceUrl ?? "").trim() !== ""
  );
}

