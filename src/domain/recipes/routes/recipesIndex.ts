import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { listFoodSummaries } from "../../../api/rpc/foods";
import { listRecipes } from "../../../api/rpc/recipes";
import { listTagUsage } from "../../../api/rpc/tags";
import type { RecipeSummary } from "../recipe";
import type { FoodSummary, TagUsage } from "../reference";
import { recipes } from "./recipes";

export const RecipeListSearch = z.object({
  q: z.string().optional(),
  // `tag` is the single slug the recipe view's tag chips link to; `tags` is the filter bar's list.
  tag: z.string().optional(),
  tags: z.array(z.string()).optional(),
  match: z.enum(["any", "all"]).optional(),
  foods: z.array(z.string()).optional(),
  favourite: z.boolean().optional(),
  /** Which shelf: the weeknight regulars, the weekend cooks, or the ones never made. Unset is everything. */
  shelf: z.enum(["rotation", "weekend", "try"]).optional(),
  sort: z.enum(["name", "created", "updated", "lastMade", "rating", "random"]).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  seed: z.string().optional(),
});

export type RecipeListData = { recipes: RecipeSummary[]; tags: TagUsage[]; foods: FoodSummary[] };

export const recipesIndex = createRoute({
  getParentRoute: () => recipes,
  path: "/",
  validateSearch: RecipeListSearch,
  loaderDeps: ({ search: { q, tag, tags, match, foods, favourite, shelf, sort, dir, seed } }) => ({
    q,
    kind: shelf === "rotation" || shelf === "weekend" ? shelf : undefined,
    neverMade: shelf === "try" ? true : undefined,
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
  component: lazyRouteComponent(() => import("../pages/RecipesPage"), "RecipesPage"),
});
