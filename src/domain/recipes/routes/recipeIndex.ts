import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { aiAvailable } from "../../../api/rpc/ai";
import { getCooking } from "../../../api/rpc/cooking";
import { getRecipe, subRecipesOf } from "../../../api/rpc/recipes";
import { listTimeline } from "../../../api/rpc/timeline";
import type { CookSession } from "../cooking";
import type { Recipe, SubRecipe, TimelineEvent } from "../recipe";
import { recipe } from "./recipe";

export const RecipeViewSearch = z.object({
  servings: z.number().positive().finite().optional(),
  /** Which option each row takes, as the plan entry chose (decisions.md row 198): ingredient id to food id. */
  choices: z.record(z.string(), z.string()).optional(),
  /** The page is being cooked from (decisions.md row 214): the nav steps aside and the page folds what is in the way. */
  cooking: z.boolean().optional(),
});

/**
 * What the page reads: the stored document, its logged cooks, and the recipes
 * its ingredient foods are made by. The sub-recipes come in one call
 * for the whole page rather than a fetch per row; a recipe with none costs no
 * request at all. The cooking session comes too (decisions.md row 214): the
 * page offers to resume it, and draws it while cooking.
 */
export type RecipeViewData = { recipe: Recipe; timeline: TimelineEvent[]; subRecipes: SubRecipe[]; aiAvailable: boolean; session: CookSession | null };

export const recipeIndex = createRoute({
  getParentRoute: () => recipe,
  path: "/",
  validateSearch: RecipeViewSearch,
  // Cooking, the page draws its own one-line header in place of the bars.
  staticData: { fullscreen: (search) => search.cooking === true },
  loader: async ({ params }): Promise<RecipeViewData> => {
    const recipe = await getRecipe({ data: { slug: params.slug } });
    // Whether a model is configured is asked here rather than in the menu, so
    // "Restyle steps" is either there or it is not. A failed ask is
    // "no model": everything else on the page still works.
    const [timeline, subRecipes, ai, session] = await Promise.all([
      listTimeline({ data: { recipeId: recipe.id } }),
      subRecipesOf({ data: { id: recipe.id } }),
      aiAvailable().catch(() => ({ available: false })),
      // A failed read is "not cooking": the page still works.
      getCooking({ data: { recipeId: recipe.id } }).catch(() => null),
    ]);
    return { recipe, timeline, subRecipes, aiAvailable: ai.available, session };
  },
  // The tab says which recipe you are on, not which app: with a dozen open,
  // every one of them reading "Garnish" tells you nothing. This wins over the
  // root's title because HeadContent walks the matches deepest-first and takes
  // the first title it finds. No loader data yet — pending, or a load that
  // failed — returns nothing and leaves the root's title in place.
  head: ({ loaderData }) => (loaderData === undefined ? {} : { meta: [{ title: loaderData.recipe.name }] }),
  component: lazyRouteComponent(() => import("../pages/RecipePage"), "RecipePage"),
});
