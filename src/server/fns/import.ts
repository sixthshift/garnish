import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { type ImportedRecipe, ScrapedRecipeSchema } from "../../domain/import";
import diagnostics, { type DiagnosticReport } from "../core/diagnostics";
import { notFoundMiddleware } from "../core/fn";
import { importer } from "../import/importer";

export const ImportFromUrlInput = z.object({ url: z.string().trim().min(1) });

/** Read a recipe from a web page: the rules' result, with the page's text for the model to read next. */
export const importFromUrl = createServerFn({ method: "POST" })
  .validator(ImportFromUrlInput)
  .handler(async ({ data }) => importer.import({ kind: "url", url: data.url }));

export const ImportFromPageInput = z.object({ html: z.string().min(1), url: z.string().trim().min(1) });

/** Read a recipe from a page the reader's own browser sent (the Save to Garnish bookmark): the same result an address gives. */
export const importFromPage = createServerFn({ method: "POST" })
  .validator(ImportFromPageInput)
  .handler(async ({ data }) => importer.import({ kind: "page", html: data.html, url: data.url }));

export const ImportFromTextInput = z.object({
  text: z.string().trim().min(1),
  /** The address the text came from, when it came from one; becomes the recipe's `sourceUrl`. */
  sourceUrl: z.string().trim().default(""),
  /**
   * The rules rung's own reading of the same page, when it had one. The client
   * already holds it, so sending it back costs nothing and saves the server a
   * second fetch of a page it has no address for.
   */
  anchor: ScrapedRecipeSchema.optional(),
});

/**
 * A model's reading that the anchor check refused, as a warning for Settings ›
 * Diagnostics: the review falls back to the page's own version and offers the
 * answer beside it, so nothing failed, but this is what explains a review that
 * came back unsorted. Null when there was no check or it passed. Pure.
 */
export function refusedImportReport(result: ImportedRecipe): DiagnosticReport | null {
  if (!result.check || result.check.ok) return null;
  return {
    source: "ai",
    level: "warning",
    name: "import",
    message: `The anchor check refused the model's reading of "${result.recipe.name}"`,
    detail: { url: result.url, check: result.check },
  };
}

/** Read a recipe out of text with a hosted model, anchored to the page's own data when there is one. */
export const importFromText = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(ImportFromTextInput)
  .handler(async ({ data }) => {
    const result = await importer.import({
      kind: "text",
      text: data.text,
      sourceUrl: data.sourceUrl,
      anchor: data.anchor ?? null,
    });
    // Inside the handler, so the client build drops the diagnostics import.
    const refused = refusedImportReport(result);
    if (refused) diagnostics.record(refused);
    return result;
  });
