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
