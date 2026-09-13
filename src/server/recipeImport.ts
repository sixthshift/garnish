// Fetching a recipe from a URL (M23.5, decisions.md row 58). The browser
// cannot read most recipe sites itself (CORS), so the server does it, exactly
// as `imageFetch` already does for a pasted image URL.
//
// Two rungs, tried in order, and the caller is told which one answered:
//
//   schema  the page carried a schema.org Recipe in its `ld+json`. This is
//           what `recipe_scrapers`' "wild mode" reads, and it is the half of
//           what Mealie and Tandoor do that does not rot per site.
//   stub    it did not, but it has OpenGraph tags. A named, illustrated,
//           linked shell with empty lists — Mealie's last non-AI rung.
//
// Neither, and it is an error naming what was missing. Tandoor stops one rung
// earlier than this and says "No usable data could be found"; Mealie has two
// AI rungs in between, which v1 does not.
//
// A page that carries a Recipe node with no ingredients and no steps counts as
// a miss, not a hit: some sites emit a Recipe shell for SEO with nothing in
// it, and falling through to the stub gets a better result than importing an
// empty recipe that looks like a successful one.
//
// The fetch sends a browser `User-Agent` because a default one gets a 403 from
// a good number of sites. That is as far as this goes: Mealie impersonates a
// real browser's TLS fingerprint with curl_cffi to get past Cloudflare, and
// Tandoor sidesteps the problem with a bookmarklet that captures the HTML the
// browser already has. Both are worth revisiting if a site actually blocks us,
// and neither is worth building first.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { recipeNodeFromHtml } from "../domain/jsonLd";
import { openGraphStub } from "../domain/openGraph";
import { hasContent, type ScrapedRecipe, scrapedFromSchema } from "../domain/schemaRecipe";

/** How much of a page is worth reading. Structured data is near the top; a page this big is not a recipe. */
export const MAX_PAGE_BYTES = 5_000_000;

/** How long to wait on a page before giving up. */
export const PAGE_TIMEOUT_MS = 15_000;

/** What a browser sends, because a default agent gets a 403 from a good number of recipe sites. */
export const IMPORT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

/**
 * Which rung produced the result, so the review can say how much it actually
 * got. `mealie` and `tandoor` are uploaded exports (M34.3, M34.4) rather than
 * rungs of the URL import, and read as well as `schema` does: both apps have
 * already parsed the recipe. `ai` is the rung under both of the URL
 * import's (M34.5): `claude -p` reading prose that carries no structure.
 */
export type ImportSource = "schema" | "stub" | "mealie" | "tandoor" | "ai";

/** What the import found, and where it came from. */
export type ImportedRecipe = {
  from: ImportSource;
  /** The page as it was asked for, after redirects. Becomes the recipe's `sourceUrl`. */
  url: string;
  recipe: ScrapedRecipe;
};

/** The pasted text as an http(s) URL, or null for anything else. Pure. */
export function parsePageUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  return url.protocol === "http:" || url.protocol === "https:" ? url : null;
}

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
    ingredients: [],
    parts: [{ name: "", steps: [] }],
  };
}

/**
 * The recipe in a page's HTML: the schema.org Recipe if it has a usable one,
 * else an OpenGraph stub, else null. Pure — the fetch is the caller's. Kept
 * separate so the whole decision can be tested without a network.
 */
export function extractRecipe(html: string, url: string): ImportedRecipe | null {
  const node = recipeNodeFromHtml(html);
  if (node !== null) {
    const recipe = scrapedFromSchema(node);
    // A Recipe node with nothing in it is an SEO shell, not a recipe.
    if (hasContent(recipe)) return { from: "schema", url, recipe };
  }
  const stub = openGraphStub(html);
  return stub === null ? null : { from: "stub", url, recipe: scrapedFromStub(stub) };
}

/** The slice of `fetch` used here; injectable for tests. Matches `imageFetch`. */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * GET the page and read a recipe out of it. Throws with a message meant for
 * the import screen when the URL is not http(s), unreachable, an error
 * response, too large, or carries neither structured data nor OpenGraph tags.
 */
export async function importRecipeFromUrl(raw: string, fetcher: Fetcher = fetch): Promise<ImportedRecipe> {
  const url = parsePageUrl(raw);
  if (!url) throw new Error("Enter an http or https address");

  let response: Response;
  try {
    response = await fetcher(url.href, {
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      headers: {
        "User-Agent": IMPORT_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
  } catch {
    throw new Error(`Could not reach ${url.hostname}`);
  }
  if (!response.ok) throw new Error(`${url.hostname} returned ${response.status}`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error(`${url.hostname} returned an empty page`);
  if (bytes.length > MAX_PAGE_BYTES) throw new Error("That page is too large to read");

  const found = extractRecipe(new TextDecoder().decode(bytes), response.url || url.href);
  if (found === null) throw new Error("No recipe data on that page. You can still start a blank recipe and type it in.");
  return found;
}

export const ImportFromUrlInput = z.object({ url: z.string().trim().min(1) });

/** Read a recipe from a web page. Nothing is written: the caller reviews it first. */
export const importFromUrl = createServerFn({ method: "POST" })
  .validator(ImportFromUrlInput)
  .handler(async ({ data }) => importRecipeFromUrl(data.url));
