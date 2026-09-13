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
