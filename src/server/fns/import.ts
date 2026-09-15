import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ScrapedRecipeSchema } from "../../domain/import";
import { aiConfigured } from "../ai/client";
import { notFoundMiddleware } from "../core/fn";
import { importer } from "../import/importer";

/**
 * Whether a model is configured, for the paste option and the Settings note.
 * Read on the server every time rather than cached: giving the container a key
 * should not need the app restarted.
 */
export const aiImportAvailable = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .handler(() => ({ available: aiConfigured() }));

export const ImportFromUrlInput = z.object({ url: z.string().trim().min(1) });

/** Read a recipe from a web page: the rules' result, with the page's text for the model to read next. */
export const importFromUrl = createServerFn({ method: "POST" })
  .validator(ImportFromUrlInput)
  .handler(async ({ data }) => importer.import({ kind: "url", url: data.url }));

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

/** Read a recipe out of text with a hosted model, anchored to the page's own data when there is one. */
export const importFromText = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(ImportFromTextInput)
  .handler(async ({ data }) =>
    importer.import({
      kind: "text",
      text: data.text,
      sourceUrl: data.sourceUrl,
      anchor: data.anchor ?? null,
    })
  );
