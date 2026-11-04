import { z } from "zod";
import { tidyParts } from "./parts";
import type { ScrapedPart, ScrapedRecipe } from "./types";

/** Did the page actually give us a recipe, or only a name? What decides whether the OpenGraph rung is needed. Pure. */
export function hasContent(scraped: ScrapedRecipe): boolean {
  return scraped.parts.some((part) => part.ingredients.length > 0 || part.steps.length > 0);
}

// --- The same shape, as a schema -------------------------------------------

/**
 * `ScrapedRecipe` as zod. The URL import builds this type by hand from
 * a page and needs no validation; an answer from `claude -p` is untrusted
 * input like any other, so the AI rung parses it through this and reports what
 * does not fit rather than saving it. Kept beside the type so the two cannot
 * drift, and it doubles as the JSON Schema handed to the CLI.
 *
 * Everything but the name has a default: an answer that leaves a field out is
 * telling us the page did not say, which is exactly what the empty value
 * means everywhere else in this file.
 */
export const ScrapedPartSchema = z.object({
  name: z.string().default(""),
  ingredients: z.array(z.string()).default([]),
  steps: z.array(z.string()).default([]),
});

export const ScrapedRecipeSchema = z.object({
  name: z.string(),
  description: z.string().default(""),
  image: z.string().nullable().default(null),
  servings: z.number().default(0),
  yieldText: z.string().default(""),
  prepMinutes: z.number().nullable().default(null),
  cookMinutes: z.number().nullable().default(null),
  tags: z.array(z.string()).default([]),
  parts: z.array(ScrapedPartSchema).default([]),
});

/**
 * A parsed answer as a `ScrapedRecipe`: blank lines dropped, part names tidied
 * out of their headings' punctuation, and at least one part, because
 * the main body is what every reader downstream expects to find. Pure.
 */
export function normaliseScraped(parsed: z.output<typeof ScrapedRecipeSchema>): ScrapedRecipe {
  const parts: ScrapedPart[] = tidyParts(
    parsed.parts
      .map((part) => ({
        name: part.name.trim(),
        ingredients: part.ingredients.map((line) => line.trim()).filter((line) => line !== ""),
        steps: part.steps.map((step) => step.trim()).filter((step) => step !== ""),
      }))
      .filter((part) => part.name !== "" || part.ingredients.length > 0 || part.steps.length > 0)
  );
  if (!parts.some((part) => part.name === "")) parts.unshift({ name: "", ingredients: [], steps: [] });
  return {
    ...parsed,
    name: parsed.name.trim(),
    tags: parsed.tags.map((tag) => tag.trim()).filter((tag) => tag !== ""),
    parts,
  };
}
