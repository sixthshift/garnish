import type { PlanDay } from "../../plan/plan";
import { daysSinceMade, fitsWeek, type RecipeSummary, sinceMade } from "../../recipes/recipe";
import type { ShoppingItem } from "../../shopping/shopping";

/** How many of a week's seven days have something on them: "4 of 7 nights planned". */
export function nightsPlanned(days: readonly PlanDay[]): number {
  return days.filter((day) => day.entries.length > 0).length;
}

/** What the list holds and how much of it is ticked, for a progress ring. */
export function listProgress(items: readonly ShoppingItem[]): { ticked: number; total: number } {
  return { ticked: items.filter((item) => item.ticked).length, total: items.length };
}

/** A weeknight recipe made more recently than this is not one you haven't made "in a while". */
const A_WHILE_DAYS = 14;

/**
 * The weeknight recipes that have gone longest uncooked: never made first
 * (newest first, as `recipes` arrives), then the oldest `lastMade`, leaving out
 * any made in the last fortnight. Only recipes marked Weeknight (decisions.md
 * row 219): a weekend dish or an unmarked one is not a regular to miss.
 */
export function longestSinceMade(recipes: readonly RecipeSummary[], today: string, limit: number): RecipeSummary[] {
  const weeknights = recipes.filter((recipe) => fitsWeek(recipe.facets, "weeknight"));
  const never = weeknights.filter((recipe) => recipe.lastMade === null);
  const made = weeknights
    .filter((recipe) => recipe.lastMade !== null && daysSinceMade(recipe.lastMade, today) >= A_WHILE_DAYS)
    .sort((a, b) => (a.lastMade ?? "").localeCompare(b.lastMade ?? "") || a.name.localeCompare(b.name));
  return [...never, ...made].slice(0, limit);
}

/** "Not made yet", "3 weeks ago", "4 months ago": how long since a recipe was last cooked, in the recipe module's one wording. */
export function sinceMadeLabel(lastMade: string | null, today: string): string {
  const since = sinceMade(lastMade, today);
  return since === null ? "Not made yet" : since[0]!.toUpperCase() + since.slice(1);
}
