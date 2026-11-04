import { recipeCook } from "./cook";
import { recipeEdit } from "./edit";
import { recipeNew } from "./new";
import { recipe } from "./recipe";
import { recipeIndex } from "./recipeIndex";
import { recipes } from "./recipes";
import { recipesIndex } from "./recipesIndex";
import { recipeStyle } from "./style";

/** The recipes' addresses: the library, a new one, and one recipe with its cook, edit and style pages. */
export const recipesRoutes = recipes.addChildren([recipesIndex, recipeNew, recipe.addChildren([recipeIndex, recipeCook, recipeEdit, recipeStyle])]);
