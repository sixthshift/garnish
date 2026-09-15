// A page in, a result out: the schema.org rung first, then the OpenGraph stub, else null.

import { recipeNodeFromHtml } from "./page/jsonLd";
import { openGraphStub } from "./page/openGraph";
import { readableText } from "./page/text";
import type { ImportedRecipe } from "./result";
import { hasContent } from "./scraped/schema";
import { scrapedFromSchema } from "./scraped/schemaOrg";
import type { ScrapedRecipe } from "./scraped/types";

/** An OpenGraph stub as a `ScrapedRecipe`: what it knows, and empty lists for what it does not. Pure. */
export function scrapedFromStub(stub: { name: string; description: string; image: string | null }): ScrapedRecipe {
  return {
    name: stub.name,
    description: stub.description,
    image: stub.image,
    servings: 0,
    yieldText: "",
    prepMinutes: null,
    cookMinutes: null,
    tags: [],
    parts: [{ name: "", ingredients: [], steps: [] }],
  };
}

/**
 * The recipe in a page's HTML: the schema.org Recipe if it has a usable one,
 * else an OpenGraph stub, else null. Pure — the fetch is the caller's, and it
 * does not matter whether the caller fetched the page or was handed it as a
 * paste: view-source-and-paste gets exactly what a successful fetch
 * would have got — the same rungs, the same `pageText` for the model to read,
 * the same result shape. Null when the page carries neither structured data
 * nor OpenGraph tags; the callers differ on what to do about that.
 *
 * A Recipe node with no ingredients and no steps counts as a miss, not a hit:
 * some sites emit a Recipe shell for SEO with nothing in it, and falling
 * through to the stub gets a better result than importing an empty recipe
 * that looks like a successful one.
 */
export function extractRecipe(html: string, url: string): ImportedRecipe | null {
  const pageText = readableText(html);
  const node = recipeNodeFromHtml(html);
  if (node !== null) {
    const recipe = scrapedFromSchema(node);
    // A Recipe node with nothing in it is an SEO shell, not a recipe.
    if (hasContent(recipe)) return { from: "schema", url, recipe, pageText };
  }
  const stub = openGraphStub(html);
  return stub === null ? null : { from: "stub", url, recipe: scrapedFromStub(stub), pageText };
}
