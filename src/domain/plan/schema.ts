import { z } from "zod";

/**
 * True when `date` is a real `YYYY-MM-DD` day. A round trip rather than
 * `Date.parse`: some engines roll 2026-02-30 over into March rather than
 * rejecting it, and a date that comes back as a different day is not the day
 * that was typed.
 */
export function isRealDate(date: string): boolean {
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
