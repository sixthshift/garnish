// Servings scaling, Cooklang-style. Pure: no IO, importable by the client.
//
// Rules:
//   - Linear ingredients (fixed: false, quantity non-null) multiply by
//     target / original servings.
//   - `fixed` ingredients (Cooklang `=`) keep their quantity: one bay leaf is one
//     bay leaf however many you feed.
//   - A null quantity ("salt to taste") stays null.
//   - `recipeYieldQuantity` scales with the servings when it is set; 0 means
//     "no yield recorded" and stays 0.
//   - `recipeServings` is set to the target.
// The input document is never mutated; a new document is returned.
//
// A recipe whose `recipeServings` is 0 (the schema default: servings unknown)
// cannot be scaled: there is no factor to derive. We throw rather than return
// the document unchanged, so a caller that shows a scaling control on such a
// recipe finds out in tests rather than by a silent no-op. Callers should hide
// the control when servings is 0.
import type { Ingredient, Recipe } from "./recipe";

export class ScaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScaleError";
  }
}

export function scaleRecipe(doc: Recipe, targetServings: number): Recipe {
  if (typeof targetServings !== "number" || !Number.isFinite(targetServings) || targetServings <= 0) {
    throw new ScaleError(`targetServings must be a finite number greater than 0, got ${String(targetServings)}`);
  }
  if (!Number.isFinite(doc.recipeServings) || doc.recipeServings <= 0) {
    throw new ScaleError(
      `recipe "${doc.name}" has no servings (recipeServings is ${String(doc.recipeServings)}) and cannot be scaled`,
    );
  }

  const factor = targetServings / doc.recipeServings;

  return {
    ...doc,
    recipeServings: targetServings,
    recipeYieldQuantity: doc.recipeYieldQuantity * factor,
    components: doc.components.map((component) => ({
      ...component,
      ingredients: component.ingredients.map((ingredient) => scaleIngredient(ingredient, factor)),
      steps: component.steps.map((step) => ({ ...step })),
    })),
    steps: doc.steps.map((step) => ({ ...step })),
    notes: doc.notes.map((note) => ({ ...note })),
    tags: doc.tags.map((tag) => ({ ...tag })),
  };
}

function scaleIngredient(ingredient: Ingredient, factor: number): Ingredient {
  if (ingredient.fixed || ingredient.quantity === null) return { ...ingredient };
  return { ...ingredient, quantity: ingredient.quantity * factor };
}
