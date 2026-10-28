import { MEALS, type Meal } from "../../../../domain/plan";
import type { StorageLike } from "../../../../lib/useLocalStorage";

// What Plan the week remembers on the device between runs: which meals beside
// dinner the planner fills, and how many are eating. The keys are the ones the
// Propose sheet used (decisions.md row 102), so a household's choices carry
// over to the screen that replaced it (row 194).

/** Where the meal choice is remembered. */
export const PLANNER_MEALS_KEY = "garnish.planner.meals";

/** Where "how many are eating" is remembered: a household's size outlives the week. */
export const PLANNER_SERVINGS_KEY = "garnish.planner.servings";

/** What a household that has never touched the stepper cooks for: four, the yield most recipes are written at. */
export const DEFAULT_SERVINGS = 4;

/** The meals besides dinner the planner may also fill. Dinner is always planned. */
export const OTHER_MEALS: readonly Meal[] = ["breakfast", "lunch"];

const isMeal = (value: unknown): value is Meal => typeof value === "string" && (MEALS as readonly string[]).includes(value);

/** The remembered meals besides dinner, in the order a day eats them. None when missing or malformed. */
export function readOtherMeals(storage: StorageLike | undefined): Meal[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(PLANNER_MEALS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const chosen = new Set(parsed.filter(isMeal));
    return OTHER_MEALS.filter((meal) => chosen.has(meal));
  } catch {
    return [];
  }
}

/** Remember the meals besides dinner. Stored with dinner, as the sheet stored them. A throwing storage just means it does not stick. */
export function writeOtherMeals(storage: StorageLike | undefined, meals: readonly Meal[]): void {
  try {
    storage?.setItem(PLANNER_MEALS_KEY, JSON.stringify(MEALS.filter((meal) => meal === "dinner" || meals.includes(meal))));
  } catch {
    // ignored: see above
  }
}

/** Tick or untick one meal, answering in meal order. Pure. */
export function toggleMeal(meals: readonly Meal[], meal: Meal): Meal[] {
  return meals.includes(meal) ? meals.filter((m) => m !== meal) : MEALS.filter((m) => m === meal || meals.includes(m));
}

/** The remembered head count: a positive number, or the default when missing or malformed. */
export function readServings(storage: StorageLike | undefined): number {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(PLANNER_SERVINGS_KEY) ?? "null");
    return typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SERVINGS;
  } catch {
    return DEFAULT_SERVINGS;
  }
}

/** Remember the head count. A throwing storage just means it does not stick. */
export function writeServings(storage: StorageLike | undefined, servings: number): void {
  try {
    storage?.setItem(PLANNER_SERVINGS_KEY, JSON.stringify(servings));
  } catch {
    // ignored: see above
  }
}
