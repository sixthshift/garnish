// Turning a stored recipe back into a write document, for "Duplicate".
// Pure: no IO, importable by the client.
//
// Mealie's duplicate copies the recipe itself and nothing that records what
// happened to it. So:
//   - the name gains " (copy)" and the repository derives a fresh slug from it;
//   - every id is dropped, recipe and children alike, so the write inserts new
//     rows rather than colliding with the original's primary keys;
//   - `lastMade` and `favourite` reset — the copy has never been cooked and
//     nobody has favourited it;
//   - reference rows (units, foods, tags) keep their ids: they are shared, and
//     the repository resolves them by id.
// The image file name is carried over: images are written once and read by
// name, so both recipes point at the same picture until one is re-uploaded.
import type { Recipe, RecipeInput } from "./recipe";

/** The suffix a duplicate's name gains, as in Mealie. */
export const COPY_SUFFIX = " (copy)";

/** `name` with the copy suffix, trimmed. Applied again on a copy of a copy. Pure. */
export function copyName(name: string): string {
  return `${name.trim()}${COPY_SUFFIX}`;
}

/** A write document that recreates `recipe` as a new one. Pure; the input is not mutated. */
export function duplicateInput(recipe: Recipe): RecipeInput {
  return {
    name: copyName(recipe.name),
    description: recipe.description,
    image: recipe.image,
    rating: recipe.rating,
    lastMade: null,
    recipeServings: recipe.recipeServings,
    recipeYieldQuantity: recipe.recipeYieldQuantity,
    yieldUnit: recipe.yieldUnit,
    recipeYield: recipe.recipeYield,
    prepTime: recipe.prepTime,
    performTime: recipe.performTime,
    sourceUrl: recipe.sourceUrl,
    favourite: false,
    tags: recipe.tags,
    notes: recipe.notes.map(({ title, text }) => ({ title, text })),
    parts: recipe.parts.map((part) => ({
      name: part.name,
      ingredients: part.ingredients.map(({ quantity, unit, food, note, originalText, fixed }) => ({
        quantity,
        unit,
        food,
        note,
        originalText,
        fixed,
      })),
      steps: part.steps.map(({ text }) => ({ text })),
    })),
  };
}
