import type { RecipeSummary } from "../../../domain/recipe";
import { listRecipes } from "../../../server/fns/recipes";

/** Search recipes by name for the add row. The route's default; tests inject their own. */
export function searchPlanRecipes(query: string): Promise<RecipeSummary[]> {
  return listRecipes({ data: { q: query } });
}
