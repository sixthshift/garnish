// home: the route. What the URL carries, what the loader reads, and
// the page it renders, loaded on demand. The page itself is page.tsx.
import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { Route as rootRoute } from "../root";
import { z } from "zod";
import type { RecipeSummary, Tag } from "../../domain/recipe/recipe";
import { listFoods } from "../../server/fns/foods";
import { listRecipes } from "../../server/fns/recipes";
import { listTags } from "../../server/fns/tags";

export const RecipeListSearch = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  tags: z.array(z.string()).optional(),
  match: z.enum(["any", "all"]).optional(),
  foods: z.array(z.string()).optional(),
  favourite: z.boolean().optional(),
  sort: z.enum(["name", "created", "updated", "lastMade", "rating", "random"]).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  seed: z.string().optional(),
});

/** Food rows as `listFoods` returns them: id and name are all the filter bar needs. */
type FoodRow = Awaited<ReturnType<typeof listFoods>>[number];

export type RecipeListData = { recipes: RecipeSummary[]; tags: Tag[]; foods: FoodRow[] };

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
    const [recipes, tags, foods] = await Promise.all([
      listRecipes({ data: deps }),
      listTags({ data: {} }),
      listFoods({ data: {} }),
    ]);
    return { recipes, tags, foods };
  },
  component: lazyRouteComponent(() => import("./page"), "RecipesPage"),
});
