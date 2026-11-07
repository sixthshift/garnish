import { useEffect, useMemo, useState } from "react";
import { toastError } from "../../../../lib/toast";
import { type RecipeSummary, sinceMade } from "../../../recipes/recipe";

/**
 * The recipes to add from, sorted into four tabs: what a desktop's shelf
 * beside the board and a phone's add sheet both browse (decisions.md rows 207
 * and 208). Outside `desktop/` and `mobile/` because both draw it.
 */
export type ShelfTab = "rotation" | "weekend" | "try" | "all";

export const SHELF_TABS: ReadonlyArray<{ value: ShelfTab; label: string }> = [
  { value: "rotation", label: "Rotation" },
  { value: "weekend", label: "Weekend" },
  { value: "try", label: "To try" },
  { value: "all", label: "All" },
];

/**
 * The recipes on one of the shelf's tabs. Rotation and Weekend are the kinds
 * the household marked (decisions.md row 191), the longest since made first,
 * since that is the one a week wants next; To try is every recipe never
 * made; All is every recipe by name. Pure.
 */
export function shelfTab(recipes: readonly RecipeSummary[], tab: ShelfTab): RecipeSummary[] {
  if (tab === "all") return [...recipes].sort((a, b) => a.name.localeCompare(b.name));
  if (tab === "try") return recipes.filter((recipe) => recipe.lastMade === null);
  return recipes.filter((recipe) => recipe.kind === tab).sort((a, b) => (a.lastMade ?? "").localeCompare(b.lastMade ?? ""));
}

/**
 * The tab the shelf opens on: the first that has a recipe on it, so a
 * household that has marked nothing Rotation yet opens on recipes, not on an
 * empty shelf. Rotation while the recipes load. Pure.
 */
export function openingTab(recipes: readonly RecipeSummary[] | null | undefined): ShelfTab {
  if (!recipes) return "rotation";
  return SHELF_TABS.find(({ value }) => shelfTab(recipes, value).length > 0)?.value ?? "all";
}

/** What a tab says when it has nothing on it. */
export function emptyShelfLine(tab: ShelfTab): string {
  if (tab === "try") return "Every recipe here has been made.";
  if (tab === "all") return "No recipes yet.";
  return `No recipe is marked ${SHELF_TABS.find(({ value }) => value === tab)?.label ?? tab} yet.`;
}

/** How long since a recipe was last made, as the shelf says it under its name: "made 3 weeks ago", "never made". Pure. */
export function madeAgo(lastMade: string | null, today: string): string {
  const since = sinceMade(lastMade, today);
  return since === null ? "never made" : `made ${since}`;
}

/**
 * Every recipe, read once as the plan opens, for the shelf's tabs and the
 * entries' times (the plan carries a recipe's name and picture, not its
 * time). Null while they load; undefined when nothing was given to read them
 * with. A plan's writes do not change them, so they are not read again.
 */
export function useShelfRecipes(read: (() => Promise<RecipeSummary[]>) | undefined): RecipeSummary[] | null | undefined {
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  useEffect(() => {
    if (read === undefined) return;
    let live = true;
    read()
      .then((found) => {
        if (live) setRecipes(found);
      })
      .catch((error: unknown) => {
        if (live) setRecipes([]);
        toastError("Couldn't load the recipes", error);
      });
    return () => {
      live = false;
    };
  }, [read]);
  return read === undefined ? undefined : recipes;
}

/** Each recipe's total time by id, for an entry's line: both layouts' entries show it. */
export function useRecipeMinutes(recipes: readonly RecipeSummary[] | null | undefined): Map<string, number | null> {
  return useMemo(() => new Map((recipes ?? []).map((recipe) => [recipe.id, recipe.totalTime])), [recipes]);
}
