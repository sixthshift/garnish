import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import type { RecipeSummary } from "../../domain/recipe";
import type { FoodSummary, TagUsage } from "../../domain/reference";
import { listFoodSummaries } from "../../server/fns/foods";
import { listRecipes } from "../../server/fns/recipes";
import { listTagUsage } from "../../server/fns/tags";
import { Route as rootRoute } from "../root";

export const RecipeListSearch = z.object({
  q: z.string().optional(),
  // `tag` is the single slug the recipe view's tag chips link to; `tags` is the filter bar's list.
  tag: z.string().optional(),
  tags: z.array(z.string()).optional(),
  match: z.enum(["any", "all"]).optional(),
  foods: z.array(z.string()).optional(),
  favourite: z.boolean().optional(),
  sort: z.enum(["name", "created", "updated", "lastMade", "rating", "random"]).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  seed: z.string().optional(),
});

export type RecipeListData = { recipes: RecipeSummary[]; tags: TagUsage[]; foods: FoodSummary[] };

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: RecipeListSearch,
  loaderDeps: ({ search: { q, tag, tags, match, foods, favourite, sort, dir, seed } }) => ({
    q,
    tag,
    tags,
    match,
    foods,
    favourite,
    sort,
    dir,
    seed,
  }),
  loader: async ({ deps }): Promise<RecipeListData> => {
    const [recipes, tags, foods] = await Promise.all([listRecipes({ data: deps }), listTagUsage(), listFoodSummaries()]);
    return { recipes, tags, foods };
  },
  component: lazyRouteComponent(() => import("./page"), "RecipesPage"),
});
