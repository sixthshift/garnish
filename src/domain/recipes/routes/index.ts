import { recipeEdit } from "./edit";
import { recipeNew } from "./new";
import { recipe } from "./recipe";
import { recipeIndex } from "./recipeIndex";
import { recipes } from "./recipes";
import { recipesIndex } from "./recipesIndex";
import { recipeReview } from "./review";
import { recipeStyle } from "./style";

/** The recipes' addresses: the library, a new one, and one recipe with its edit, style and review pages. */
export const recipesRoutes = recipes.addChildren([recipesIndex, recipeNew, recipe.addChildren([recipeIndex, recipeEdit, recipeStyle, recipeReview])]);
