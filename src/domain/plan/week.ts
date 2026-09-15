import type { Recipe } from "../recipe";
import { recipeAdditions, type ShoppingAddition } from "../shopping";
import { weekDates } from "./dates";
import { dayLabel } from "./labels";
import type { PlanDay, PlanEntry } from "./schema";

/**
 * Entries laid out as the seven days beginning `monday`: every day present in
 * order, each with its entries in the order they arrived, and anything outside
 * the week ignored.
 */
export function groupByDay(monday: string, entries: readonly PlanEntry[]): PlanDay[] {
  const byDate = new Map<string, PlanEntry[]>(weekDates(monday).map((date) => [date, []]));
  for (const entry of entries) byDate.get(entry.date)?.push(entry);
  return [...byDate].map(([date, dayEntries]) => ({ date, entries: dayEntries }));
}

/**
 * Which entry moved, given a day's ids before and after a reorder, and where
 * it landed. Null when the two orders are the same. Pure.
 *
 * `ReorderList` hands back a whole rearranged array; the repository moves one
 * row to one position. This is the translation between them: the first and
 * last indices that differ bracket the move, and which end holds the moved id
 * says which way it went.
 */
export function reorderMove(before: readonly string[], after: readonly string[]): { id: string; position: number } | null {
  if (before.length !== after.length) return null;
  let first = 0;
  while (first < before.length && before[first] === after[first]) first += 1;
  if (first === before.length) return null;
  let last = before.length - 1;
  while (last > first && before[last] === after[last]) last -= 1;
  return before[first] === after[last] ? { id: after[last] as string, position: last } : { id: after[first] as string, position: first };
}

// --- Adding the week to the shopping list ---------------------------
// "Add this week to the shopping list" in the plan's header: every recipe
// entry's own ingredients, at the entry's servings (the recipe's own when
// unset), plus every plain-text entry as its own free-text line — the same
// additions the recipe page's own "Add to shopping list" sheet builds
// (`recipeAdditions`, src/domain/shopping/subRecipe.ts), except every source's
// `partName` is the entry's day (`dayLabel`) rather than the recipe's own
// part: a shopping line remembers which day of the week asked for it, not
// which section of the recipe it came from.
//
// Pure: `recipesByEntry` carries the already-scaled recipe document for every
// recipe entry, keyed by the entry's own id rather than the recipe's, so the
// same recipe planned twice at different servings does not collide. The
// caller (`addPlanWeekToShopping`, src/server/fns/plan.ts) fetches and scales
// them through the same path `getRecipe` takes; an entry missing from the map
// — its recipe not fetched, or already null because the recipe was deleted —
// contributes nothing.

/**
 * What a week contributes to the shopping list, in day order: every recipe
 * entry's buyable ingredients through `recipesByEntry`, and every text entry
 * as a free-text line, both stamped with the entry's day as `partName`. Pure.
 */
export function planWeekAdditions(days: readonly PlanDay[], recipesByEntry: ReadonlyMap<string, Recipe>): ShoppingAddition[] {
  const additions: ShoppingAddition[] = [];
  for (const day of days) {
    const partName = dayLabel(day.date);
    for (const entry of day.entries) {
      if (entry.recipe === null) {
        const line = entry.text.trim();
        if (line === "") continue;
        additions.push({
          quantity: null,
          unit: null,
          food: null,
          originalText: entry.text,
          fixed: false,
          source: { recipeId: null, recipeName: "", partName, servings: null },
        });
        continue;
      }
      const recipe = recipesByEntry.get(entry.id);
      if (recipe === undefined) continue;
      const servings = recipe.recipeServings > 0 ? recipe.recipeServings : null;
      additions.push(...recipeAdditions(recipe, () => ({ recipeId: recipe.id, recipeName: recipe.name, partName, servings })));
    }
  }
  return additions;
}
