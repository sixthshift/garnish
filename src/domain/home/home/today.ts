import { dayName, dayParts, isWeekend, mealLabel, nextMonday, type PlanDay, type PlanEntry, servingsLabel } from "../../plan/plan";
import { formatDuration } from "../../recipes/ingredient";
import type { RecipeSummary } from "../../recipes/recipe";
import type { HomeData } from "./data";

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

/** "Wed 16", the short day a week card leads with. */
export function shortDay(date: string): string {
  const { weekday, day } = dayParts(date);
  return `${weekday} ${day.split(" ")[0]}`;
}

/** The recipe page's search for cooking a plan entry: its servings and its choices, when it has them. */
export function cookSearch(entry: PlanEntry): { servings?: number; choices?: PlanEntry["choices"] } {
  return {
    ...(entry.servings === null ? {} : { servings: entry.servings }),
    ...(Object.keys(entry.choices).length > 0 ? { choices: entry.choices } : {}),
  };
}

/**
 * What both of Home's layouts read off the day: its title, tonight's entry and
 * the library's card for its recipe, whether next week wants planning now (a
 * weekend with nothing on it yet), and next week's Monday. Pure.
 */
export function homeToday({ today, monday, days, nextDays, recipes }: Pick<HomeData, "today" | "monday" | "days" | "nextDays" | "recipes">) {
  const tonight = tonightEntry(days.find((day) => day.date === today));
  return {
    title: todayTitle(today),
    tonight,
    recipe: tonight?.recipe ? recipes.find((r) => r.id === tonight.recipe?.id) : undefined,
    planNow: isWeekend(today) && entryCount(nextDays) === 0,
    next: nextMonday(monday),
  };
}

/** Tonight's small print: the meal, the total time and the servings, whichever there are. Pure. */
export function tonightMeta(entry: PlanEntry, totalTime: number | null): string {
  return [mealLabel(entry.meal), totalTime !== null ? formatDuration(totalTime) : null, servingsLabel(entry.servings) || null].filter(Boolean).join(" · ");
}
