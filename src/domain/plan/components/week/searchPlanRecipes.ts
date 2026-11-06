import { listRecipes } from "../../../../api/rpc/recipes";
import type { RecipeSummary } from "../../../recipes/recipe";

/** Search recipes by name for the add row. The route's default; tests inject their own. */
export function searchPlanRecipes(query: string): Promise<RecipeSummary[]> {
  return listRecipes({ data: { q: query } });
}

/** Every recipe, by name, for a desktop's shelf to sort into its tabs. The route's default; tests inject their own. */
export function shelfPlanRecipes(): Promise<RecipeSummary[]> {
  return listRecipes({ data: { sort: "name" } });
}
