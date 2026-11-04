import { listRecipes } from "../../../../api/rpc/recipes";
import type { RecipeSummary } from "../../../recipes/recipe";

/** Search recipes by name for the add row. The route's default; tests inject their own. */
export function searchPlanRecipes(query: string): Promise<RecipeSummary[]> {
  return listRecipes({ data: { q: query } });
}
