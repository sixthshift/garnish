import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import type { Recipe } from "../../../../domain/recipe";
import type { Tag, Unit } from "../../../../domain/reference";
import { getRecipe } from "../../../../server/fns/recipes";
import { listTags } from "../../../../server/fns/tags";
import { listUnits } from "../../../../server/fns/units";
import { Route as rootRoute } from "../../../root";

export const EditRecipeSearch = z.object({
  servings: z.number().positive().finite().optional(),
});

export type EditRecipeData = { recipe: Recipe; units: Unit[]; tags: Tag[] };

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recipes/$slug/edit",
  validateSearch: EditRecipeSearch,
  loader: async ({ params }): Promise<EditRecipeData> => {
    const [recipe, units, tags] = await Promise.all([getRecipe({ data: { slug: params.slug } }), listUnits({ data: {} }), listTags({ data: {} })]);
    return { recipe, units, tags };
  },
  component: lazyRouteComponent(() => import("./page"), "EditRecipePage"),
});
