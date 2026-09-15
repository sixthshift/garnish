// Meal plan document: the shape the API reads and writes for the one household
// plan (decisions.md row 71). Pure: no IO, no bun:sqlite. Importable by the
// client.
//
// Mirrors src/db/migrations/007_plan.sql column for column in camelCase, with
// the same conventions the recipe and shopping documents follow:
//   - Array order is `position`, and the read document keeps it because a day's
//     entries are a draggable list.
//   - The foreign key comes back as a nested object (`recipe`), carrying only
//     the summary fields the week strip draws — name, slug, image — the way a
//     shopping line carries its food. Writes send `recipeId`.
//   - A week is read as seven `PlanDay`s rather than a flat list, because a day
//     with nothing on it is part of the answer: the page draws Monday to Sunday
//     whether or not anything is planned.
//
// Days, not meals: there is no entry type, and a day holds as many entries as
// it holds (decisions.md row 71).
import { z } from "zod";
import type { Recipe } from "../recipe";
import { recipeAdditions, type ShoppingAddition } from "../shopping";

/**
 * True when `date` is a real `YYYY-MM-DD` day. A round trip rather than
 * `Date.parse`: some engines roll 2026-02-30 over into March rather than
 * rejecting it, and a date that comes back as a different day is not the day
 * that was typed.
 */
function isRealDate(date: string): boolean {
  const at = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === date;
}

/** `YYYY-MM-DD`, the same calendar date the table's GLOB check enforces. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "a date is YYYY-MM-DD")
  .refine(isRealDate, "not a real date");

const id = z.uuid();
const text = z.string().default("");
const servings = z.number().positive().nullable().default(null);

/**
 * What a planned recipe shows on the week: its name, its picture and the slug
 * to open it. Not the full `recipeSummarySchema` — the plan does not draw
 * ratings, times or tags, and a week of days should not cost a week of tag
 * reads.
 */
export const planRecipeSchema = z.object({
  id,
  slug: z.string().min(1),
  name: z.string().min(1),
  image: z.string().nullable(),
});

/** One entry on one day: a recipe entry (`recipe` set) or a plain line (`text`). */
export const planEntrySchema = z.object({
  id,
  date: isoDate,
  position: z.number().int().nonnegative(),
  recipe: planRecipeSchema.nullable().default(null),
  text, // the whole entry when there is no recipe; '' on a recipe entry
  servings, // null: the recipe's own servings
});

/** One day of the week, entries in position order. Empty is a normal day. */
export const planDaySchema = z.object({
  date: isoDate,
  entries: z.array(planEntrySchema).default([]),
});

// --- Write shape ------------------------------------------------------------
// Ids are server-generated, `position` is the end of the day, and the recipe is
// an id.

/** One entry as a caller sends it. An entry with neither a recipe nor text is rejected. */
export const planEntryInputSchema = z
  .object({
    date: isoDate,
    recipeId: id.nullable().default(null),
    text,
    servings,
  })
  .refine((entry) => entry.recipeId !== null || entry.text.trim() !== "", {
    message: "an entry needs a recipe or some text",
  });

/** A patch over an existing entry. Absent fields are left alone; moving a day is `move`. */
export const planEntryPatchSchema = z.object({
  recipeId: id.nullable().optional(),
  text: z.string().optional(),
  servings: z.number().positive().nullable().optional(),
});

// --- Types ------------------------------------------------------------------

export type PlanRecipe = z.infer<typeof planRecipeSchema>;
export type PlanEntry = z.infer<typeof planEntrySchema>;
export type PlanDay = z.infer<typeof planDaySchema>;
/** What a caller sends to add an entry. Defaults not yet applied. */
export type PlanEntryInput = z.input<typeof planEntryInputSchema>;
/** A parsed PlanEntryInput: defaults applied, ready for the repository. */
export type ParsedPlanEntryInput = z.infer<typeof planEntryInputSchema>;
export type PlanEntryPatch = z.infer<typeof planEntryPatchSchema>;

// --- Dates -------------------------------------------------------------------
// Calendar arithmetic on `YYYY-MM-DD` strings, done in UTC so a household in
// Melbourne and a container in UTC agree on which day a string names. Dates are
// strings everywhere in this file: a Date carries a time and a zone, and the
// plan has neither.

/** Midnight UTC of a `YYYY-MM-DD` string. Throws on a string that is not one. */
function utc(date: string): Date {
  if (!isRealDate(date)) throw new Error(`not a date: ${date}`);
  return new Date(`${date}T00:00:00Z`);
}

/** `YYYY-MM-DD` of a UTC instant. */
function iso(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** The date `days` after `date` (negative goes back). Crosses months and years. */
export function addDays(date: string, days: number): string {
  const at = utc(date);
  at.setUTCDate(at.getUTCDate() + days);
  return iso(at);
}

/**
 * The Monday of the week containing `date`. The week starts on Monday, which is
 * what an en-AU calendar does and what Mealie's plan does; a Sunday belongs to
 * the week that began six days earlier.
 */
export function mondayOf(date: string): string {
  const at = utc(date);
  const weekday = at.getUTCDay(); // 0 Sunday .. 6 Saturday
  return addDays(date, weekday === 0 ? -6 : 1 - weekday);
}

/** The seven dates of the week beginning `monday`, Monday first. */
export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

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

// --- Labels ------------------------------------------------------------------
// The week strip's own text. Written out rather than handed to `Intl` because
// these are read from `YYYY-MM-DD` strings that mean a calendar day and nothing
// else: `Intl` would want a zone for them, and its short month names move with
// the ICU the container happens to ship ("Sep" became "Sept" in en-AU). Short
// forms, en-AU, so a day fits a phone column.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** A day's column heading: "Mon 14 Sep". */
export function dayLabel(date: string): string {
  const at = utc(date);
  return `${WEEKDAYS[at.getUTCDay()]} ${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`;
}

/**
 * The week's span, as short as it can be said: "14 – 20 Sep 2026" inside one
 * month, "28 Sep – 4 Oct 2026" across two, and both years across New Year.
 */
export function weekLabel(monday: string): string {
  const from = utc(monday);
  const to = utc(addDays(monday, 6));
  const part = (at: Date) => `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`;
  if (from.getUTCFullYear() !== to.getUTCFullYear()) {
    return `${part(from)} ${from.getUTCFullYear()} – ${part(to)} ${to.getUTCFullYear()}`;
  }
  if (from.getUTCMonth() !== to.getUTCMonth()) return `${part(from)} – ${part(to)} ${to.getUTCFullYear()}`;
  return `${from.getUTCDate()} – ${part(to)} ${to.getUTCFullYear()}`;
}

/**
 * Today as the household sees it, `YYYY-MM-DD`. Local rather than UTC: the
 * arithmetic above is UTC because a date string has no zone, but "today" is a
 * question about the wall clock in the kitchen, and in Melbourne the UTC date
 * is yesterday for the first ten hours of every day.
 */
export function todayIso(at: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** Whether `date` is the day being lived. Pure; `today` is injectable so tests do not move. */
export function isToday(date: string, today: string = todayIso()): boolean {
  return date === today;
}

/**
 * The Monday the page should show: the `?week=` param when it is a real date
 * (normalised to its Monday, so a mid-week link still lands on a whole week),
 * and the week containing `today` otherwise.
 */
export function weekMonday(week: string | undefined, today: string = todayIso()): string {
  return mondayOf(week !== undefined && isoDate.safeParse(week).success ? week : today);
}

/**
 * What an entry reads as. The recipe's name when it still has one, and the
 * entry's own `text` otherwise — which is why adding a recipe copies its name
 * into `text`: a recipe deleted a month later leaves a day that still says
 * what was cooked.
 */
export function entryLabel(entry: Pick<PlanEntry, "recipe" | "text">): string {
  const name = entry.recipe?.name ?? "";
  return name !== "" ? name : entry.text;
}

/** "serves 4" under an entry, or nothing when the recipe's own servings stand. */
export function servingsLabel(servings: number | null): string {
  return servings === null ? "" : `serves ${Number(servings.toFixed(2))}`;
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

// --- Adding the week to the shopping list (M33.3) ---------------------------
// "Add this week to the shopping list" in the plan's header: every recipe
// entry's own ingredients, at the entry's servings (the recipe's own when
// unset), plus every plain-text entry as its own free-text line — the same
// additions the recipe page's own "Add to shopping list" sheet builds
// (`recipeAdditions`, src/domain/shopping/shopping.ts), except every source's
// `partName` is the entry's day (`dayLabel`) rather than the recipe's own
// part: a shopping line remembers which day of the week asked for it, not
// which section of the recipe it came from.
//
// Pure: `recipesByEntry` carries the already-scaled recipe document for every
// recipe entry, keyed by the entry's own id rather than the recipe's, so the
// same recipe planned twice at different servings does not collide. The
// caller (`addPlanWeekToShopping`, src/server/plan.ts) fetches and scales
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
