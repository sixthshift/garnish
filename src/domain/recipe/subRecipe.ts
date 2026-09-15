import { convert, type Food, type Unit } from "../reference";
import type { Ingredient, Recipe } from "./recipe";

/** What the parent needs about a child recipe: enough to link to it and to scale it. */
export type SubRecipe = Pick<Recipe, "id" | "slug" | "name" | "recipeServings" | "recipeYieldQuantity" | "yieldUnit">;

/** The ingredient fields the scale reads: its amount and the food that names the child. */
export type SubRecipeIngredient = Pick<Ingredient, "quantity" | "unit" | "food">;

/**
 * `quantity` of `unit` of `food`, expressed in `yieldUnit`, or null when the
 * two cannot be related. Two absent units mean a countless yield measured the
 * same countless way ("makes 12", "2 of them"), so the quantity stands as it
 * is; one absent unit relates to nothing. Pure.
 */
function amountInYieldUnit(quantity: number, unit: Unit | null, food: Food | null, yieldUnit: Unit | null): number | null {
  if (unit === null && yieldUnit === null) return quantity;
  if (unit === null || yieldUnit === null) return null;
  if (unit.id === yieldUnit.id) return quantity;
  if (food === null) return null;
  return convert(quantity, unit, food, yieldUnit);
}

/**
 * The servings of `child` that yield this ingredient's amount, or null when
 * nothing relates them: no amount on the row, no yield or no servings on the
 * child, or no conversion between the row's unit and the child's yield unit.
 * Pure.
 */
export function subRecipeScale(ingredient: SubRecipeIngredient, child: SubRecipe): number | null {
  const { quantity, unit, food } = ingredient;
  if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) return null;
  if (!(child.recipeServings > 0) || !(child.recipeYieldQuantity > 0)) return null;

  const amount = amountInYieldUnit(quantity, unit, food, child.yieldUnit);
  if (amount === null || !Number.isFinite(amount) || amount <= 0) return null;

  const servings = (amount / child.recipeYieldQuantity) * child.recipeServings;
  return Number.isFinite(servings) && servings > 0 ? servings : null;
}

/** The scale as the row shows it: "Make 2 servings", rounded to two places. Pure. */
export function subRecipeHint(servings: number): string {
  const rounded = Number(servings.toFixed(2));
  return `Make ${rounded} ${rounded === 1 ? "serving" : "servings"}`;
}

/**
 * The scale as cook mode's link reads it: "Open <name> at 2 servings", the
 * child's own name standing in for the bare food name the hint uses.
 * Rounded to two places, same as `subRecipeHint`. Pure.
 */
export function subRecipeCookLabel(servings: number, name: string): string {
  const rounded = Number(servings.toFixed(2));
  return `Open ${name} at ${rounded} ${rounded === 1 ? "serving" : "servings"}`;
}

/**
 * The ids of every recipe reached by an ingredient's food in this recipe, in
 * first-seen order and de-duplicated. The view loader fetches them in one call
 * rather than a read per row. Pure.
 */
export function subRecipeIds(recipe: Pick<Recipe, "parts">): string[] {
  const ids = new Set<string>();
  for (const part of recipe.parts) {
    for (const row of part.ingredients) {
      if (row.food?.recipeId) ids.add(row.food.recipeId);
    }
  }
  return [...ids];
}

/** The sub-recipes keyed by recipe id, for a row to look its food's child up in. Pure. */
export function subRecipeMap(children: readonly SubRecipe[]): Map<string, SubRecipe> {
  return new Map(children.map((child) => [child.id, child]));
}
