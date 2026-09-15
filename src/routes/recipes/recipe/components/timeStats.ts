import { formatDuration, totalMinutes } from "../../../../domain/ingredient";
import type { Recipe } from "../../../../domain/recipe";

export type StatKey = "prep" | "cook" | "total";

/** Prep / cook / total, dropping the ones with nothing recorded. Pure. */
export function timeStats(recipe: Pick<Recipe, "prepTime" | "performTime">): Array<{ key: StatKey; label: string; value: string }> {
  const total = totalMinutes(recipe.prepTime, recipe.performTime);
  const rows: Array<{ key: StatKey; label: string; value: string }> = [
    { key: "prep", label: "Prep", value: formatDuration(recipe.prepTime) },
    { key: "cook", label: "Cook", value: formatDuration(recipe.performTime) },
    { key: "total", label: "Total", value: formatDuration(total) },
  ];
  return rows.filter((row) => row.value !== "");
}
