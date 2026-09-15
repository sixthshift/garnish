import { formatIngredient } from "../ingredient";
import { type Ingredient, type Recipe, type SubRecipe, subRecipeScale } from "../recipe";
import type { ShoppingAddition, ShoppingAdditionSource } from "./merge";

/** The line's own text: the original wording, or the formatted line when there is none. Pure. */
function displayText(ingredient: Ingredient): string {
  return ingredient.originalText.trim() || formatIngredient(ingredient).trim();
}

/**
 * One recipe's own buyable ingredients as additions: every part in order, an
 * on-hand food dropped and a food-less row with nothing to say dropped, same
 * as the sheet's own rows follow (`buyable` in
 * src/components/shopping/AddToShoppingSheet.tsx). `sourceForPart` builds each row's
 * source from its part's trimmed name — `childIngredientAdditions`
 * uses the child's own part names, and `planWeekAdditions` (src/domain/plan/week.ts) uses one name shared by every row: the plan day rather
 * than the recipe's own part. Pure.
 */
export function recipeAdditions(recipe: Recipe, sourceForPart: (partName: string) => ShoppingAdditionSource): ShoppingAddition[] {
  const additions: ShoppingAddition[] = [];
  for (const part of recipe.parts) {
    const partName = part.name.trim();
    for (const ingredient of part.ingredients) {
      if (ingredient.food !== null && ingredient.food.skipShopping) continue;
      const originalText = displayText(ingredient);
      if (ingredient.food === null && originalText === "") continue;
      additions.push({
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        food: ingredient.food,
        originalText,
        fixed: ingredient.fixed,
        source: sourceForPart(partName),
      });
    }
  }
  return additions;
}

/**
 * The child's own rows as additions, already scaled: `recipeAdditions` with
 * every row stamped with the child recipe as source, its own part names.
 */
function childIngredientAdditions(childRecipe: Recipe): ShoppingAddition[] {
  const servings = childRecipe.recipeServings > 0 ? childRecipe.recipeServings : null;
  return recipeAdditions(childRecipe, (partName) => ({ recipeId: childRecipe.id, recipeName: childRecipe.name, partName, servings }));
}

/**
 * What "Add hollandaise's ingredients instead" contributes: the child's own
 * ingredients (`childIngredientAdditions`) at the servings `subRecipeScale`
 * derives from `ingredient` and `child` — or, when the two amounts cannot be
 * related (no derivable scale, or `childRecipe` not fetched yet), `ingredient`
 * itself as the one line it would have contributed unexpanded, stamped with
 * `parentSource`. Pure.
 */
export function subRecipeAdditions(
  ingredient: Ingredient,
  child: SubRecipe,
  childRecipe: Recipe | null,
  parentSource: ShoppingAdditionSource
): ShoppingAddition[] {
  const servings = subRecipeScale(ingredient, child);
  if (servings === null || childRecipe === null) {
    return [
      {
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        food: ingredient.food,
        originalText: displayText(ingredient),
        fixed: ingredient.fixed,
        source: parentSource,
      },
    ];
  }
  return childIngredientAdditions(childRecipe);
}
