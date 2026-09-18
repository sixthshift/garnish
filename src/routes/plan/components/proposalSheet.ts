// The proposal sheet's pure half (M39.5): which days a run covers and how
// that choice is remembered, the line that says which meals are on, and the
// model's answer arranged by day, ticked, and turned into the payload
// `applyPlanProposal` takes. No React and no IO beyond the storage handed in,
// so every rule here is driven by a test rather than by a click.

import { dayParts, type Meal, mealLabel, todayIso, weekDates } from "../../../domain/plan";
import { enabledMeals, type PlannerMeal } from "../../../domain/planner";
import type { StorageLike } from "../../../lib/prefs";
import type { ProposedWeek, TakenSlot } from "../../../server/ai/planner";

/** Where the day choice is remembered between runs. */
export const PLANNER_DAYS_KEY = "garnish.planner.days";

/** The seven letters the checkboxes carry, Monday first. */
export const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/** Every weekday index, which is what a household that has never touched the sheet gets. */
export const ALL_DAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

/** The hint under a Propose button that cannot run because the week has no meals to plan. */
export const NO_MEALS_HINT = "No meals are on — turn one on in Settings.";

/**
 * The remembered days as weekday indices, 0 Monday to 6 Sunday. Indices rather
 * than dates: the choice is "we plan weekends" and outlives the week it was
 * made in. Anything missing, malformed or empty falls back to all seven, the
 * way `lib/prefs` reads its preferences.
 */
export function readProposalDays(storage: StorageLike | undefined): number[] {
  if (storage === undefined) return [...ALL_DAYS];
  try {
    const raw = storage.getItem(PLANNER_DAYS_KEY);
    if (raw == null) return [...ALL_DAYS];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...ALL_DAYS];
    const days = [...new Set(parsed.filter((value): value is number => Number.isInteger(value) && value >= 0 && value <= 6))].sort((a, b) => a - b);
    return days.length === 0 ? [...ALL_DAYS] : days;
  } catch {
    return [...ALL_DAYS];
  }
}

/** Remember the ticked days. A throwing storage just means the choice does not stick. */
export function writeProposalDays(storage: StorageLike | undefined, days: readonly number[]): void {
  if (storage === undefined) return;
  try {
    storage.setItem(PLANNER_DAYS_KEY, JSON.stringify([...days].sort((a, b) => a - b)));
  } catch {
    // ignored: see above
  }
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

/**
 * Which meals a proposal plans for, and where to change it: "Dinner only —
 * change in Settings." for one, "Lunch and dinner — …" for two. Pure.
 */
export function mealsLine(meals: readonly PlannerMeal[]): string {
  const on = enabledMeals(meals).map((meal) => mealLabel(meal) ?? "");
  if (on.length === 0) return NO_MEALS_HINT;
  if (on.length === 1) return `${on[0]} only — change in Settings.`;
  const cased = on.map((name, i) => (i === 0 ? name : name.toLowerCase()));
  return `${cased.slice(0, -1).join(", ")} and ${cased.at(-1)} — change in Settings.`;
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
