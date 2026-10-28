import { addDays, dayName, type PlanDay, type PlanEntry } from "../../../domain/plan";
import type { RecipeSummary } from "../../../domain/recipe";

/**
 * The entry Home calls tonight's: the day's dinner when one is marked, else
 * its last recipe entry, else its last line. Most entries name no meal
 * (decisions.md row 100), and a day holding a lunch and a dinner is usually
 * written in that order, so the last is the evening's. Null on an empty day.
 */
export function tonightEntry(day: PlanDay | undefined): PlanEntry | null {
  if (day === undefined || day.entries.length === 0) return null;
  const dinner = day.entries.find((entry) => entry.meal === "dinner");
  if (dinner !== undefined) return dinner;
  return day.entries.findLast((entry) => entry.recipe !== null) ?? day.entries.at(-1) ?? null;
}

/**
 * Saturday or Sunday: when the household sits down to plan the week ahead, so
 * Home brings next week forward if it is still empty.
 */
export function isWeekend(date: string): boolean {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

/** How many entries a week holds. */
export function entryCount(days: readonly PlanDay[]): number {
  return days.reduce((count, day) => count + day.entries.length, 0);
}

/**
 * The recipes kept but never cooked, newest first: what an import or a share
 * leaves behind until someone makes it. `recipes` arrives newest first.
 */
export function toTry(recipes: readonly RecipeSummary[], limit: number): RecipeSummary[] {
  return recipes.filter((recipe) => recipe.lastMade === null).slice(0, limit);
}

/** "Wednesday" and "28 October" from a date, for Home's title and the line under it. */
export function todayTitle(date: string): { weekday: string; date: string } {
  const [weekday = "", ...rest] = dayName(date).split(" ");
  return { weekday, date: rest.join(" ") };
}

/** The Monday after the week beginning `monday`. */
export function nextMonday(monday: string): string {
  return addDays(monday, 7);
}
