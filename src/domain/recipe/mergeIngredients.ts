// One ingredient list across a recipe's parts, merged by food and unit; a fixed or null-quantity line never merges.

import type { Ingredient, Part } from "./recipe";

/** True for ingredients that fold into a summed group; false for lines kept on their own. */
function isMergeable(ingredient: Ingredient): boolean {
  return !ingredient.fixed && ingredient.quantity !== null;
}

/** Merge identity: same food (or, lacking one, the same raw text) and the same unit. */
function mergeKey(ingredient: Ingredient): string {
  const foodKey = ingredient.food !== null ? `food:${ingredient.food.id}` : `raw:${ingredient.originalText.trim()}`;
  const unitKey = ingredient.unit !== null ? `unit:${ingredient.unit.id}` : "unit:none";
  return `${foodKey}|${unitKey}`;
}

/**
 * One flat ingredient list for the whole recipe: every part's ingredients, in
 * order, merged by food and unit with quantities summed.
 * `fixed` and null-quantity lines never merge, even with a matching food and
 * unit, and appear once per occurrence. Pure; the input is not mutated.
 */
export function mergeIngredients(recipe: { parts: ReadonlyArray<Pick<Part, "ingredients">> }): Ingredient[] {
  const merged: Ingredient[] = [];
  const groups = new Map<string, Ingredient>();

  for (const part of recipe.parts) {
    for (const ingredient of part.ingredients) {
      const { quantity, fixed, note } = ingredient;
      if (fixed || quantity === null) {
        merged.push({ ...ingredient });
        continue;
      }

      const key = mergeKey(ingredient);
      const existing = groups.get(key);
      if (existing === undefined) {
        const created = { ...ingredient };
        groups.set(key, created);
        merged.push(created);
        continue;
      }

      existing.quantity = (existing.quantity ?? 0) + quantity;
      if (existing.note.trim() !== note.trim()) existing.note = "";
    }
  }

  return merged;
}
