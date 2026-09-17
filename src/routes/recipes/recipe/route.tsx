import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import type { Recipe, SubRecipe, TimelineEvent } from "../../../domain/recipe";
import { aiImportAvailable } from "../../../server/fns/import";
import { getRecipe, subRecipesOf } from "../../../server/fns/recipes";
import { listTimeline } from "../../../server/fns/timeline";
import { Route as rootRoute } from "../../root";

export const RecipeViewSearch = z.object({
  servings: z.number().positive().finite().optional(),
  /**
   * Open the restyle sheet on arrival. The new recipe page sets it
   * after an import's Create when a model is configured, and the sheet clears
   * it again on dismiss, so a reload does not re-offer a rewrite nobody asked
   * for twice.
   */
  restyle: z.boolean().optional(),
});

/**
 * What the page reads: the stored document, its logged cooks, and the recipes
 * its ingredient foods are made by. The sub-recipes come in one call
 * for the whole page rather than a fetch per row; a recipe with none costs no
 * request at all.
 */
export type RecipeViewData = { recipe: Recipe; timeline: TimelineEvent[]; subRecipes: SubRecipe[]; aiAvailable: boolean };

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recipes/$slug",
  validateSearch: RecipeViewSearch,
  loader: async ({ params }): Promise<RecipeViewData> => {
    const recipe = await getRecipe({ data: { slug: params.slug } });
    // Whether a model is configured is asked here rather than in the menu, so
    // "Restyle steps" is either there or it is not. A failed ask is
    // "no model": everything else on the page still works.
    const [timeline, subRecipes, ai] = await Promise.all([
      listTimeline({ data: { recipeId: recipe.id } }),
      subRecipesOf({ data: { id: recipe.id } }),
      aiImportAvailable().catch(() => ({ available: false })),
    ]);
    return { recipe, timeline, subRecipes, aiAvailable: ai.available };
  },
  component: lazyRouteComponent(() => import("./page"), "RecipePage"),
});
