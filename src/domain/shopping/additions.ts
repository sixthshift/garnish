import { formatIngredient } from "../ingredient";
import type { Ingredient, Recipe, SubRecipe } from "../recipe";
import type { ShoppingAddition, ShoppingAdditionSource } from "./merge";
import { subRecipeAdditions } from "./subRecipe";

/** One part's buyable ingredients, in page order. `name` is '' for the unnamed part. */
export type ShoppingGroup = { id: string; name: string; ingredients: Ingredient[] };

/** The line a food-less ingredient becomes on the list: its own text, or its formatted self. Pure. */
export function ingredientText(ingredient: Ingredient): string {
  const original = ingredient.originalText.trim();
  return original === "" ? formatIngredient(ingredient).trim() : original;
}

/** False for a row that can never reach the list: an on-hand food, or nothing to name. Pure. */
export function buyable(ingredient: Ingredient): boolean {
  if (ingredient.food !== null) return !ingredient.food.skipShopping;
  return ingredientText(ingredient) !== "";
}

/**
 * The sheet's rows, grouped by part: parts in order, each with the ingredients
 * that can reach the list, and empty groups dropped. Pure.
 */
export function shoppingGroups(recipe: Pick<Recipe, "parts">): ShoppingGroup[] {
  return recipe.parts
    .map((part) => ({ id: part.id, name: part.name.trim(), ingredients: part.ingredients.filter(buyable) }))
    .filter((group) => group.ingredients.length > 0);
}

/** One ingredient as an addition, unexpanded: its own amount, stamped with `source`. Pure. */
export function ingredientAddition(ingredient: Ingredient, source: ShoppingAdditionSource): ShoppingAddition {
  return {
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    food: ingredient.food,
    originalText: ingredientText(ingredient),
    fixed: ingredient.fixed,
    source,
  };
}

/**
 * The included rows as additions for `mergeIntoList`, at whatever scale the
 * passed recipe is already at, each stamped with this recipe, its part and the
 * servings it was added at. `excluded` holds the ingredient ids tapped off.
 * Pure.
 */
export function additionsFor(recipe: Recipe, excluded: ReadonlySet<string> = new Set()): ShoppingAddition[] {
  const servings = recipe.recipeServings > 0 ? recipe.recipeServings : null;
  return shoppingGroups(recipe).flatMap((group) =>
    group.ingredients
      .filter((ingredient) => !excluded.has(ingredient.id))
      .map((ingredient) => ingredientAddition(ingredient, { recipeId: recipe.id, recipeName: recipe.name, partName: group.name, servings }))
  );
}

/**
 * `additionsFor`, plus the sub-recipe swap: a row whose id is in `expanded` and whose
 * food is made by a recipe in `subRecipes` contributes the child's own rows
 * instead of its own (`subRecipeAdditions`, src/domain/shopping/subRecipe.ts), using
 * `childRecipes[ingredient.id]` as the already-scaled child document when the
 * caller has fetched one. A row not in `expanded`, or whose food is not a
 * sub-recipe, is unaffected. Pure.
 */
export function additionsForWithSubRecipes(
  recipe: Recipe,
  excluded: ReadonlySet<string>,
  expanded: ReadonlySet<string>,
  subRecipes: ReadonlyMap<string, SubRecipe>,
  childRecipes: Readonly<Record<string, Recipe>>
): ShoppingAddition[] {
  const servings = recipe.recipeServings > 0 ? recipe.recipeServings : null;
  return shoppingGroups(recipe).flatMap((group) =>
    group.ingredients
      .filter((ingredient) => !excluded.has(ingredient.id))
      .flatMap((ingredient) => {
        const source: ShoppingAdditionSource = { recipeId: recipe.id, recipeName: recipe.name, partName: group.name, servings };
        if (!expanded.has(ingredient.id)) return [ingredientAddition(ingredient, source)];
        const child = ingredient.food?.recipeId ? (subRecipes.get(ingredient.food.recipeId) ?? null) : null;
        if (child === null) return [ingredientAddition(ingredient, source)];
        return subRecipeAdditions(ingredient, child, childRecipes[ingredient.id] ?? null, source);
      })
  );
}
