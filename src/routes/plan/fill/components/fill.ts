import { addDays, type Meal, type PlanDay, weekDates } from "../../../../domain/plan";
import type { RecipeSummary } from "../../../../domain/recipe";
import type { ProposedWeek } from "../../../../server/ai/planner";

// Filling a week: the weeknights from the recipes the household marked
// Rotation, the ones not had for longest first, and the weekend chosen from
// those marked Weekend and the ones never made (decisions.md row 192). With a
// model configured its proposal makes the first pass instead, and the same
// choices follow (row 194). Pure; the page holds the choices and writes them.

/** Why a weeknight got the recipe it did, as the row says it. */
export type NightReason = { kind: "carried" } | { kind: "never" } | { kind: "weeks"; weeks: number };

/** The open weeknights and weekend days of the week beginning `monday`: no entries yet, and not already gone by. */
export function openDays(monday: string, days: readonly PlanDay[], today: string): { weeknights: string[]; weekend: string[] } {
  const taken = new Set(days.filter((day) => day.entries.length > 0).map((day) => day.date));
  const open = weekDates(monday).filter((date) => date >= today && !taken.has(date));
  const weekendDates = new Set([addDays(monday, 5), addDays(monday, 6)]);
  return { weeknights: open.filter((date) => !weekendDates.has(date)), weekend: open.filter((date) => weekendDates.has(date)) };
}

/** A last-made stamp as its calendar day, or null. */
const madeOn = (recipe: RecipeSummary): string | null => recipe.lastMade?.slice(0, 10) ?? null;

/**
 * The planned recipes that did not happen: a recipe entry on a day gone by
 * whose recipe was not made on or after that day. The cook log is the
 * evidence; a meal cooked without pressing Made this reads as missed, which
 * costs one tap to leave out. In the order planned, each recipe once.
 */
export function missedRecipes(days: readonly PlanDay[], recipes: ReadonlyMap<string, RecipeSummary>, today: string): RecipeSummary[] {
  const missed = new Map<string, RecipeSummary>();
  for (const day of days) {
    if (day.date >= today) continue;
    for (const entry of day.entries) {
      const recipe = entry.recipe && recipes.get(entry.recipe.id);
      if (!recipe) continue;
      const made = madeOn(recipe);
      if (made === null || made < day.date) missed.set(recipe.id, recipe);
    }
  }
  return [...missed.values()];
}

/**
 * The rotation in the order the planner offers it: never made first, then the
 * longest since made. Recipes in `exclude` (already planned, or eaten last
 * week) are left out.
 */
export function rotationPool(recipes: readonly RecipeSummary[], exclude: ReadonlySet<string>): RecipeSummary[] {
  return recipes
    .filter((recipe) => recipe.kind === "rotation" && !exclude.has(recipe.id))
    .sort((a, b) => (madeOn(a) ?? "").localeCompare(madeOn(b) ?? "") || a.name.localeCompare(b.name));
}

/**
 * What Swap draws from: the rotation, or every recipe not marked Weekend when
 * nothing is marked Rotation yet, in the same order and with the same
 * exclusions. A household that has not marked its regulars, or whose week the
 * planner chose, can still swap a night.
 */
export function swapPool(recipes: readonly RecipeSummary[], exclude: ReadonlySet<string>): RecipeSummary[] {
  const rotation = rotationPool(recipes, exclude);
  if (rotation.length > 0) return rotation;
  return recipes
    .filter((recipe) => recipe.kind !== "weekend" && !exclude.has(recipe.id))
    .sort((a, b) => (madeOn(a) ?? "").localeCompare(madeOn(b) ?? "") || a.name.localeCompare(b.name));
}

/**
 * The weeknights' first offer: what did not happen last week first, then the
 * rotation in order. A night with nothing left to offer is null, a night off.
 */
export function fillNights(count: number, carried: readonly RecipeSummary[], pool: readonly RecipeSummary[]): (string | null)[] {
  const ids = [...new Set([...carried, ...pool].map((recipe) => recipe.id))];
  return Array.from({ length: count }, (_, index) => ids[index] ?? null);
}

/**
 * Night `index` swapped for the next recipe in `pool` after its own that no
 * other night holds, wrapping round. Unchanged when the pool has nothing else
 * to give.
 */
export function swapNight(nights: readonly (string | null)[], index: number, pool: readonly RecipeSummary[]): (string | null)[] {
  const current = nights[index] ?? null;
  const start = pool.findIndex((recipe) => recipe.id === current);
  for (let step = 1; step <= pool.length; step++) {
    const candidate = pool[(start + step + pool.length) % pool.length];
    if (candidate && !nights.includes(candidate.id)) return nights.map((id, i) => (i === index ? candidate.id : id));
  }
  return [...nights];
}

/**
 * What the weekend is chosen from: the recipes marked Weekend, the longest
 * since made first, then the ones never made that are not in the rotation,
 * newest first. `recipes` arrives newest first.
 */
export function weekendShelf(recipes: readonly RecipeSummary[]): RecipeSummary[] {
  const weekend = recipes.filter((recipe) => recipe.kind === "weekend").sort((a, b) => (madeOn(a) ?? "").localeCompare(madeOn(b) ?? ""));
  const toTry = recipes.filter((recipe) => recipe.lastMade === null && recipe.kind === null);
  return [...weekend, ...toTry];
}

/** Why `recipe` is on a night: carried over, never made, or how many whole weeks since it was. */
export function nightReason(recipe: RecipeSummary, carried: ReadonlySet<string>, today: string): NightReason {
  if (carried.has(recipe.id)) return { kind: "carried" };
  const made = madeOn(recipe);
  if (made === null) return { kind: "never" };
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${made}T00:00:00Z`)) / 86_400_000;
  return { kind: "weeks", weeks: Math.max(0, Math.floor(days / 7)) };
}

/** A NightReason as the row reads it. */
export function reasonLabel(reason: NightReason): string {
  if (reason.kind === "carried") return "Didn't happen last week";
  if (reason.kind === "never") return "Not made yet";
  if (reason.weeks === 0) return "Made this week";
  return reason.weeks === 1 ? "Last made a week ago" : `Last made ${reason.weeks} weeks ago`;
}

// --- The model's first pass (decisions.md row 194) -------------------------------

/** A breakfast or lunch the model proposed: shown beside the dinners, each one skippable. */
export type OtherMeal = { date: string; meal: Meal; recipeId: string; skip: boolean };

/** Where a model's reason is kept: the slot's date and the recipe it was given for, so a swap leaves it behind. */
export const reasonKey = (date: string, recipeId: string): string => `${date}:${recipeId}`;

/** The session's choices as a proposal sets them. */
export type FirstPass = { nights: (string | null)[]; weekend: (string | null)[]; others: OtherMeal[]; reasons: Record<string, string> };

/**
 * The model's proposal as the session's starting choices: its dinners on the
 * open weeknights and weekend days, its other meals beside them, and its
 * reason for each. A weeknight it left empty, or filled with a recipe already
 * used, is filled from `fallback` (what did not happen, then the rotation), so
 * a short answer still gives a whole week. Pure.
 */
export function fromProposal(
  week: ProposedWeek,
  open: { weeknights: readonly string[]; weekend: readonly string[] },
  fallback: readonly RecipeSummary[]
): FirstPass {
  const dinner = new Map(week.entries.filter((entry) => entry.meal === "dinner").map((entry) => [entry.date, entry.recipeId]));
  const used = new Set<string>();
  const take = (id: string | undefined) => {
    if (id === undefined || used.has(id)) return null;
    used.add(id);
    return id;
  };
  const weekend = open.weekend.map((date) => take(dinner.get(date)));
  const proposed = open.weeknights.map((date) => take(dinner.get(date)));
  const spare = fallback.map((recipe) => recipe.id).filter((id) => !used.has(id));
  const nights = proposed.map((id) => id ?? spare.shift() ?? null);
  const others = week.entries
    .filter((entry) => entry.meal !== "dinner")
    .map((entry) => ({ date: entry.date, meal: entry.meal, recipeId: entry.recipeId, skip: false }));
  const reasons = Object.fromEntries(
    week.entries.filter((entry) => entry.reason.trim() !== "").map((entry) => [reasonKey(entry.date, entry.recipeId), entry.reason])
  );
  return { nights, weekend, others, reasons };
}

/** Everything the session writes, as `applyPlanProposal` takes it: the dinners chosen, then the other meals not skipped. Pure. */
export function sessionEntries(
  open: { weeknights: readonly string[]; weekend: readonly string[] },
  nights: readonly (string | null)[],
  weekend: readonly (string | null)[],
  others: readonly OtherMeal[]
): { date: string; meal: Meal; recipeId: string }[] {
  const dinners = [...open.weeknights.map((date, i) => [date, nights[i]] as const), ...open.weekend.map((date, i) => [date, weekend[i]] as const)].flatMap(
    ([date, recipeId]) => (recipeId ? [{ date, meal: "dinner" as const, recipeId }] : [])
  );
  return [...dinners, ...others.filter((other) => !other.skip).map(({ date, meal, recipeId }) => ({ date, meal, recipeId }))];
}
