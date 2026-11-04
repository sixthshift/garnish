import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { aiAvailable } from "../../../api/rpc/ai";
import { getRecipe } from "../../../api/rpc/recipes";
import type { Recipe } from "../recipe";
import { recipe } from "./recipe";

export type StyleRecipeData = { recipe: Recipe; aiAvailable: boolean };

export const recipeStyle = createRoute({
  getParentRoute: () => recipe,
  path: "style",
  // A task finished with Save or Cancel: the phone tab bar steps aside (decision 143).
  staticData: { hideNav: true },
  loader: async ({ params }): Promise<StyleRecipeData> => {
    const [recipe, ai] = await Promise.all([getRecipe({ data: { slug: params.slug } }), aiAvailable().catch(() => ({ available: false }))]);
    return { recipe, aiAvailable: ai.available };
  },
  component: lazyRouteComponent(() => import("../pages/StyleRecipePage"), "StyleRecipePage"),
});
