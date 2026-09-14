// edit: the route. What the URL carries, what the loader reads, and
// the page it renders, loaded on demand. The page itself is page.tsx.
import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { Route as rootRoute } from "../../../root";
import { z } from "zod";
import type { Recipe, Tag, Unit } from "../../../../domain/recipe/recipe";
import { getRecipe } from "../../../../server/fns/recipes";
import { listTags } from "../../../../server/fns/tags";
import { listUnits } from "../../../../server/fns/units";

export const EditRecipeSearch = z.object({
  servings: z.number().positive().finite().optional(),
});

export type EditRecipeData = { recipe: Recipe; units: Unit[]; tags: Tag[] };

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recipes/$slug/edit",
  validateSearch: EditRecipeSearch,
  loader: async ({ params }): Promise<EditRecipeData> => {
    const [recipe, units, tags] = await Promise.all([
      getRecipe({ data: { slug: params.slug } }),
      listUnits({ data: {} }),
      listTags({ data: {} }),
    ]);
    return { recipe, units, tags };
  },
  component: lazyRouteComponent(() => import("./page"), "EditRecipePage"),
});
