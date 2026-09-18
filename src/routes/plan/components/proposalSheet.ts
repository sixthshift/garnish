// The proposal sheet's pure half (M39.5): which days and which meals a run
// covers and how those choices are remembered, and the model's answer arranged
// by day, ticked, and turned into the payload `applyPlanProposal` takes. No
// React and no IO beyond the storage handed in, so every rule here is driven
// by a test rather than by a click.

import { dayParts, type Meal, todayIso, weekDates } from "../../../domain/plan";
import { MEALS } from "../../../domain/planner";
import type { StorageLike } from "../../../lib/useLocalStorage";
import type { ProposedWeek, TakenSlot } from "../../../server/ai/planner";

/** Where the day choice is remembered between runs. */
export const PLANNER_DAYS_KEY = "garnish.planner.days";

/** Where the meal choice is remembered between runs, beside the days: both are per-run (decisions.md row 102). */
export const PLANNER_MEALS_KEY = "garnish.planner.meals";

/** The seven letters the checkboxes carry, Monday first. */
export const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/** Every weekday index, which is what a household that has never touched the sheet gets. */
export const ALL_DAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

/** What a household that has never touched the sheet plans: dinner, which is the week most of them fill. */
export const DEFAULT_MEALS: readonly Meal[] = ["dinner"];

/**
 * One remembered list, read off the storage: the JSON array under `key`,
 * keeping only the values `keep` accepts, deduplicated and in `order`. Missing,
 * malformed or empty falls back to `fallback`, the way `lib/prefs` reads its
 * preferences — the two choices on this sheet are remembered the same way, so
 * they are read by the same function.
 */
function readRemembered<T>(
  storage: StorageLike | undefined,
  key: string,
  order: readonly T[],
  keep: (value: unknown) => value is T,
  fallback: readonly T[]
): T[] {
  if (storage === undefined) return [...fallback];
  try {
    const raw = storage.getItem(key);
    if (raw == null) return [...fallback];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...fallback];
    const chosen = new Set(parsed.filter(keep));
    const values = order.filter((value) => chosen.has(value));
    return values.length === 0 ? [...fallback] : values;
  } catch {
    return [...fallback];
  }
}

/** Remember one list. A throwing storage just means the choice does not stick. */
function writeRemembered<T>(storage: StorageLike | undefined, key: string, order: readonly T[], values: readonly T[]): void {
  if (storage === undefined) return;
  try {
    storage.setItem(key, JSON.stringify(order.filter((value) => values.includes(value))));
  } catch {
    // ignored: see above
  }
}

/**
 * The remembered days as weekday indices, 0 Monday to 6 Sunday. Indices rather
 * than dates: the choice is "we plan weekends" and outlives the week it was
 * made in. Anything missing, malformed or empty falls back to all seven.
 */
export function readProposalDays(storage: StorageLike | undefined): number[] {
  return readRemembered(storage, PLANNER_DAYS_KEY, ALL_DAYS, isDayIndex, ALL_DAYS);
}

/** Remember the ticked days. */
export function writeProposalDays(storage: StorageLike | undefined, days: readonly number[]): void {
  writeRemembered(storage, PLANNER_DAYS_KEY, ALL_DAYS, days);
}

/**
 * The remembered meals, in the order a day eats them. Dinner when nothing has
 * been remembered: the household that never opens this row gets the week it
 * would have got from the old Settings default.
 */
export function readProposalMeals(storage: StorageLike | undefined): Meal[] {
  return readRemembered(storage, PLANNER_MEALS_KEY, MEALS, isMeal, DEFAULT_MEALS);
}

/** Remember the ticked meals, in meal order. */
export function writeProposalMeals(storage: StorageLike | undefined, meals: readonly Meal[]): void {
  writeRemembered(storage, PLANNER_MEALS_KEY, MEALS, meals);
}

function isDayIndex(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 6;
}

function isMeal(value: unknown): value is Meal {
  return typeof value === "string" && (MEALS as readonly string[]).includes(value);
}

/** Tick or untick one meal, answering in meal order. Pure. */
export function toggleProposalMeal(meals: readonly Meal[], meal: Meal): Meal[] {
  return meals.includes(meal) ? meals.filter((m) => m !== meal) : MEALS.filter((m) => m === meal || meals.includes(m));
}

/** One of the seven checkboxes: its letter, its date, and whether it can be ticked at all. */
export type ProposalDay = {
  index: number;
  date: string;
  /** M T W T F S S. */
  letter: string;
  /** The date under the letter, "14 Sep". */
  day: string;
  ticked: boolean;
  /** A day before today: a proposal is for what is coming, so it is unticked and cannot be pressed. */
  past: boolean;
};

/** The shown week as seven checkboxes, the remembered choice applied and yesterday ruled out. Pure. */
export function proposalDays(monday: string, remembered: readonly number[], today: string = todayIso()): ProposalDay[] {
  return weekDates(monday).map((date, index) => {
    const past = date < today;
    return { index, date, letter: DAY_LETTERS[index] ?? "", day: dayParts(date).day, past, ticked: !past && remembered.includes(index) };
  });
}

/** Tick or untick one day; a past day never moves. Pure. */
export function toggleProposalDay(days: readonly ProposalDay[], index: number): ProposalDay[] {
  return days.map((day) => (day.index === index && !day.past ? { ...day, ticked: !day.ticked } : day));
}

/** The dates a run covers, in week order. Pure. */
export function tickedDates(days: readonly ProposalDay[]): string[] {
  return days.filter((day) => day.ticked).map((day) => day.date);
}

/** The indices to remember: what was ticked, plus the past days, so a week later they come back. Pure. */
export function rememberedDays(days: readonly ProposalDay[]): number[] {
  return days.filter((day) => day.ticked || day.past).map((day) => day.index);
}

/** A slot and its meal together are the row's identity, and so its tick's key. Pure. */
export function slotKey(date: string, meal: Meal): string {
  return `${date} ${meal}`;
}

/** One proposed row, ready to draw: the recipe, the meal it fills and why the model chose it. */
export type ProposalRow = { key: string; date: string; meal: Meal; recipeId: string; name: string; slug: string; image: string | null; reason: string };

/** One day of the answer: what was proposed, what was left empty, and what the week already had. */
export type ProposalDayGroup = { date: string; rows: ProposalRow[]; unfilled: Meal[]; taken: TakenSlot[] };

/** The answer by day, days in calendar order and each day's rows in meal order as the model answered. Pure. */
export function groupProposal(week: ProposedWeek): ProposalDayGroup[] {
  const byDate = new Map<string, ProposalDayGroup>();
  const dayOf = (date: string): ProposalDayGroup => {
    const found = byDate.get(date) ?? { date, rows: [], unfilled: [], taken: [] };
    byDate.set(date, found);
    return found;
  };
  for (const entry of week.entries) {
    dayOf(entry.date).rows.push({
      key: slotKey(entry.date, entry.meal),
      date: entry.date,
      meal: entry.meal,
      recipeId: entry.recipeId,
      name: entry.recipe.name,
      slug: entry.recipe.slug,
      image: entry.recipe.image,
      reason: entry.reason,
    });
  }
  for (const slot of week.unfilled) dayOf(slot.date).unfilled.push(slot.meal);
  for (const slot of week.taken) dayOf(slot.date).taken.push(slot);
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Every proposed row starts ticked: the household unticks what it does not want. Pure. */
export function initialTicked(week: ProposedWeek): Set<string> {
  return new Set(week.entries.map((entry) => slotKey(entry.date, entry.meal)));
}

/** What `applyPlanProposal` is sent: the ticked rows only, in the answer's order. Pure. */
export function applyPayload(week: ProposedWeek, ticked: ReadonlySet<string>): { date: string; meal: Meal; recipeId: string }[] {
  return week.entries
    .filter((entry) => ticked.has(slotKey(entry.date, entry.meal)))
    .map((entry) => ({ date: entry.date, meal: entry.meal, recipeId: entry.recipeId }));
}

/** The toast after a successful add: "5 meals added". Pure. */
export function addedMealsMessage(count: number): string {
  return `${count} ${count === 1 ? "meal" : "meals"} added`;
}
