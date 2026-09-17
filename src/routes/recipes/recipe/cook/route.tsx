import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import type { Recipe, SubRecipe } from "../../../../domain/recipe";
import { getRecipe, subRecipesOf } from "../../../../server/fns/recipes";
import { Route as rootRoute } from "../../../root";

export const CookSearch = z.object({
  servings: z.number().positive().finite().optional(),
  /**
   * Card index; absent means 0. Optional rather than `.default(0)` so the URL
   * without it is already canonical (a default would make the router rewrite
   * `/cook` to `/cook?step=0`). Out-of-range values are clamped at render time.
   */
  step: z.number().int().nonnegative().optional(),
  /** The parent recipe's slug, when this cook session was opened from a sub-recipe link. */
  from: z.string().optional(),
});

/** What the loader reads: the stored document, the recipes its ingredient foods are made by, and the entering parent's name, if any. */
export type CookRouteData = { recipe: Recipe; subRecipes: SubRecipe[]; parentName: string | null };

/** The `from` slug's recipe name, or null when there is no `from` or it no longer resolves to one. Not pure: reads through the server function. */
async function resolveParentName(from: string | undefined): Promise<string | null> {
  if (from === undefined) return null;
  try {
    return (await getRecipe({ data: { slug: from } })).name;
  } catch {
    return null;
  }
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recipes/$slug/cook",
  validateSearch: CookSearch,
  staticData: { fullscreen: true },
  loaderDeps: ({ search: { from } }) => ({ from }),
  loader: async ({ params, deps }): Promise<CookRouteData> => {
    const recipe = await getRecipe({ data: { slug: params.slug } });
    const [subRecipes, parentName] = await Promise.all([subRecipesOf({ data: { id: recipe.id } }), resolveParentName(deps.from)]);
    return { recipe, subRecipes, parentName };
  },
  component: lazyRouteComponent(() => import("./page"), "CookPage"),
});
