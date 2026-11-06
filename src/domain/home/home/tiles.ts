import type { PlanDay } from "../../plan/plan";
import type { RecipeSummary } from "../../recipes/recipe";
import type { ShoppingItem } from "../../shopping/shopping";

/** How many of a week's seven days have something on them: "4 of 7 nights planned". */
export function nightsPlanned(days: readonly PlanDay[]): number {
  return days.filter((day) => day.entries.length > 0).length;
}

/** What the list holds and how much of it is ticked, for a progress ring. */
export function listProgress(items: readonly ShoppingItem[]): { ticked: number; total: number } {
  return { ticked: items.filter((item) => item.ticked).length, total: items.length };
}

/** Whole days from the date part of `lastMade` to `today`, both `YYYY-MM-DD` in UTC as the plan's arithmetic is. */
function daysSince(lastMade: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastMade.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

/** A rotation recipe made more recently than this is not one you haven't made "in a while". */
const A_WHILE_DAYS = 14;

/**
 * The rotation's regulars that have gone longest uncooked: never made first
 * (newest first, as `recipes` arrives), then the oldest `lastMade`, leaving out
 * any made in the last fortnight. Only recipes marked Rotation (decisions.md
 * row 191): a weekend dish or an unmarked one is not a regular to miss.
 */
export function longestSinceMade(recipes: readonly RecipeSummary[], today: string, limit: number): RecipeSummary[] {
  const rotation = recipes.filter((recipe) => recipe.kind === "rotation");
  const never = rotation.filter((recipe) => recipe.lastMade === null);
  const made = rotation
    .filter((recipe) => recipe.lastMade !== null && daysSince(recipe.lastMade, today) >= A_WHILE_DAYS)
    .sort((a, b) => (a.lastMade ?? "").localeCompare(b.lastMade ?? "") || a.name.localeCompare(b.name));
  return [...never, ...made].slice(0, limit);
}

/** "Not made yet", "3 weeks ago", "4 months ago": how long since a recipe was last cooked. */
export function sinceMadeLabel(lastMade: string | null, today: string): string {
  if (lastMade === null) return "Not made yet";
  const days = Math.max(0, daysSince(lastMade, today));
  if (days < 7) return "This week";
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return weeks === 1 ? "A week ago" : `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "A year ago" : `${years} years ago`;
}
