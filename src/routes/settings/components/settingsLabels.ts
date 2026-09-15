import type { RecipeSummary } from "../../../domain/recipe";
import type { Unit } from "../../../domain/reference";
import type { FoodRow } from "../route";

/** The name shown for a delete or merge confirm: the row's name, or a count for several. Pure. */
export function unitsLabel(units: readonly Unit[]): string {
  return units.length === 1 ? units[0]!.name : `${units.length} units`;
}

/** The name shown for a delete or merge confirm: the row's name, or a count for several. Pure. */
export function foodsLabel(foods: readonly FoodRow[]): string {
  return foods.length === 1 ? foods[0]!.name : `${foods.length} foods`;
}

/** Every recipe from any of the lists, once, in first-seen order. Pure. */
export function dedupeSummaries(lists: readonly RecipeSummary[][]): RecipeSummary[] {
  const seen = new Map<string, RecipeSummary>();
  for (const list of lists) for (const recipe of list) if (!seen.has(recipe.id)) seen.set(recipe.id, recipe);
  return [...seen.values()];
}
