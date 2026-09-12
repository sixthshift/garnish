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
import { mergeIngredients } from "./merge";
import type { Ingredient, Part, Recipe } from "./recipe";

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
    parts: doc.parts.map((part) => ({
      ...part,
      ingredients: part.ingredients.map((ingredient) => scaleIngredient(ingredient, factor)),
      steps: part.steps.map((step) => ({ ...step })),
    })),
    notes: doc.notes.map((note) => ({ ...note })),
    tags: doc.tags.map((tag) => ({ ...tag })),
  };
}

/**
 * The document as a page should show it for a requested servings: `undefined`
 * (no `?servings=` in the URL) or a recipe with no servings recorded comes back
 * as stored, anything else is scaled. Exactly what `getRecipe({ servings })`
 * returns for the same document, so the client can scale a document the loader
 * fetched once instead of asking the server per tap (M25.1, decisions.md row
 * 62). Pure; the input document is returned by identity when nothing scales.
 */
export function scaledForServings(doc: Recipe, targetServings: number | undefined): Recipe {
  if (targetServings === undefined || !(doc.recipeServings > 0)) return doc;
  return scaleRecipe(doc, targetServings);
}

function scaleIngredient(ingredient: Ingredient, factor: number): Ingredient {
  if (ingredient.fixed || ingredient.quantity === null) return { ...ingredient };
  return { ...ingredient, quantity: ingredient.quantity * factor };
}

/**
 * The servings that would make one ingredient's currently-displayed quantity
 * read as `targetAmount`, given the servings the page is currently showing
 * (`currentServings` — the recipe's own servings, or the requested scale when
 * one is in effect). Proportional, like `scaleRecipe`: `currentServings *
 * (targetAmount / ingredient.quantity)`.
 *
 * Throws for a `fixed` ingredient (Cooklang `=`, never scales, so it cannot
 * be a scaling target) or one with no positive quantity to derive a factor
 * from, and for a non-positive or non-finite `targetAmount` or
 * `currentServings`. Pure.
 */
export function servingsForTarget(
  ingredient: Pick<Ingredient, "quantity" | "fixed">,
  targetAmount: number,
  currentServings: number,
): number {
  if (typeof targetAmount !== "number" || !Number.isFinite(targetAmount) || targetAmount <= 0) {
    throw new ScaleError(`targetAmount must be a finite number greater than 0, got ${String(targetAmount)}`);
  }
  if (typeof currentServings !== "number" || !Number.isFinite(currentServings) || currentServings <= 0) {
    throw new ScaleError(`currentServings must be a finite number greater than 0, got ${String(currentServings)}`);
  }
  if (ingredient.fixed) {
    throw new ScaleError("a fixed ingredient does not scale with servings and cannot be a scaling target");
  }
  if (ingredient.quantity === null || !Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) {
    throw new ScaleError(`ingredient has no quantity to scale from (${String(ingredient.quantity)})`);
  }

  return currentServings * (targetAmount / ingredient.quantity);
}

/**
 * The ingredients a "Scale to..." picker can offer: merged across every part
 * (`mergeIngredients`, so a food split between parts is one line and one
 * target), excluding a `fixed` ingredient (Cooklang `=`, never scales) and one
 * with no positive quantity (nothing for `servingsForTarget` to derive a
 * factor from). Pure.
 */
export function scalableIngredients(recipe: { parts: ReadonlyArray<Pick<Part, "ingredients">> }): Ingredient[] {
  return mergeIngredients(recipe).filter(
    (ingredient) => !ingredient.fixed && ingredient.quantity !== null && ingredient.quantity > 0,
  );
}
