import { createRoute, lazyRouteComponent, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { listFoodSummaries } from "../../../api/rpc/foods";
import { listRecipes, recipeFacetCounts, recipeShelfCounts } from "../../../api/rpc/recipes";
import { listTagUsage } from "../../../api/rpc/tags";
import { type FacetCount, facetsFromSearch } from "../components/facets/facetSearch";
import type { RecipeSummary, ShelfCounts } from "../recipe";
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
  /** The ones never made, or unset for everything. `rotation` and `weekend` are an old link's, which `beforeLoad` sends on to the week facet (row 219). */
  shelf: z.enum(["try", "rotation", "weekend"]).optional(),
  // What a recipe is, one param a layer (decisions.md row 209). Strings, not the lists' enums: a value
  // the lists dropped narrows by nothing rather than failing the page (facetsFromSearch).
  course: z.array(z.string()).optional(),
  meal: z.array(z.string()).optional(),
  week: z.array(z.string()).optional(),
  cuisine: z.array(z.string()).optional(),
  diet: z.array(z.string()).optional(),
  mainIngredient: z.array(z.string()).optional(),
  method: z.array(z.string()).optional(),
  season: z.array(z.string()).optional(),
  sort: z.enum(["name", "created", "updated", "lastMade", "rating", "random"]).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  seed: z.string().optional(),
});

/** `shelves` is how many recipes each shelf holds over the whole library, for a desktop's filters column. */
export type RecipeListData = { recipes: RecipeSummary[]; tags: TagUsage[]; foods: FoodSummary[]; shelves: ShelfCounts; facetCounts: FacetCount[] };

export const recipesIndex = createRoute({
  getParentRoute: () => recipes,
  path: "/",
  validateSearch: RecipeListSearch,
  // The Rotation and Weekend shelves are the week facet since decisions.md row 219: an old link to one goes on to the same recipes.
  beforeLoad: ({ search }) => {
    if (search.shelf !== "rotation" && search.shelf !== "weekend") return;
    throw redirect({ to: "/recipes", search: { ...search, shelf: undefined, week: [search.shelf === "rotation" ? "weeknight" : "weekend"] } });
  },
  loaderDeps: ({ search: { q, tag, tags, match, foods, favourite, shelf, sort, dir, seed, ...layers } }) => ({
    q,
    neverMade: shelf === "try" ? true : undefined,
    tag,
    tags,
    match,
    foods,
    favourite,
    facets: facetsFromSearch(layers),
    sort,
    dir,
    seed,
  }),
  loader: async ({ deps }): Promise<RecipeListData> => {
    const [recipes, tags, foods, shelves, facetCounts] = await Promise.all([
      listRecipes({ data: deps }),
      listTagUsage(),
      listFoodSummaries(),
      recipeShelfCounts(),
      recipeFacetCounts(),
    ]);
    return { recipes, tags, foods, shelves, facetCounts };
  },
  component: lazyRouteComponent(() => import("../pages/RecipesPage"), "RecipesPage"),
});
