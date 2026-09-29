import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import type { Recipe } from "../../../../domain/recipe";
import { aiImportAvailable } from "../../../../server/fns/import";
import { getRecipe } from "../../../../server/fns/recipes";
import { Route as rootRoute } from "../../../root";

export type StyleRecipeData = { recipe: Recipe; aiAvailable: boolean };

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recipes/$slug/style",
  loader: async ({ params }): Promise<StyleRecipeData> => {
    const [recipe, ai] = await Promise.all([getRecipe({ data: { slug: params.slug } }), aiImportAvailable().catch(() => ({ available: false }))]);
    return { recipe, aiAvailable: ai.available };
  },
  component: lazyRouteComponent(() => import("./page"), "StyleRecipePage"),
});
