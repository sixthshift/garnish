import { z } from "zod";
import { tagSchema } from "../reference";
import { facetsSchema } from "./facets";

/**
 * The answer to "which recipes": what a list entry needs and nothing else. A
 * query returns these; `get` returns the document. Nothing else produces one.
 */
export const recipeSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  image: z.string().nullable(),
  rating: z.number().min(0).max(5).nullable(),
  prepTime: z.number().int().nonnegative().nullable(),
  performTime: z.number().int().nonnegative().nullable(),
  /** prepTime + performTime; null when neither is recorded. See domain/recipes/ingredient/format.ts's totalMinutes. */
  totalTime: z.number().int().nonnegative().nullable(),
  lastMade: z.iso.datetime().nullable(),
  favourite: z.boolean(),
  /** What it is, layer by layer (row 209). */
  facets: facetsSchema,
  tags: z.array(tagSchema),
  /** The first ingredient lines, part order then row order, formatted with domain/recipes/ingredient/format.ts's formatIngredient. */
  ingredientPreview: z.array(z.string()),
});

export type RecipeSummary = z.infer<typeof recipeSummarySchema>;

/** How many recipes each shelf of the library holds, over the whole collection: `all` every recipe, `try` the never made. */
export type ShelfCounts = { all: number; try: number };
