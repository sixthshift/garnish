// Fetching a recipe from a URL (M23.5, decisions.md row 58). The browser
// cannot read most recipe sites itself (CORS), so the server does it, exactly
// as `imageFetch` does for an imported recipe's image. This file is only the
// fetch: what happens to the page once it is in hand — the schema.org and
// OpenGraph rungs, the readable text — is the import module's `extractRecipe`
// (`src/domain/import`), which is pure and takes a pasted page as readily as a
// fetched one.
//
// The fetch sends a full browser header set (M35.4) because a default one, or
// even a bare `User-Agent`, gets a 403 from a good number of sites. A 403 gets
// one retry under a second header profile before this gives up — see
// `fetchProfiles.ts` beside this file — and only then does the error say the site
// is blocking automated requests and point at the paste box (M34.5), which
// since M36.7 takes the page's HTML as well as its prose: a paste that looks
// like a page's source goes through the same `extractRecipe` a fetched page
// goes through. That is as far as this goes: Mealie impersonates a real browser's TLS fingerprint
// with curl_cffi to get past Cloudflare, and Tandoor sidesteps the problem
// with a bookmarklet that captures the HTML the browser already has. Both are
// worth revisiting if headers alone stop being enough — see docs/plan.md's
// Log for M35.4 on Serious Eats, which they are not.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchProfileForAttempt, FETCH_PROFILES } from "./fetchProfiles";
import { extractRecipe, type ImportedRecipe } from "../../domain/import";

/** How much of a page is worth reading. Structured data is near the top; a page this big is not a recipe. */
export const MAX_PAGE_BYTES = 5_000_000;

/** How long to wait on a page before giving up. */
export const PAGE_TIMEOUT_MS = 15_000;

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

/** The slice of `fetch` used here; injectable for tests. Matches `imageFetch`. */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * GET `url` with a browser header profile; on a 403, once more under the next
 * profile before giving up. A single fixed header set is itself a
 * fingerprint some sites already block on its own, so a retry under a
 * different one is worth the extra round trip; a status other than 403 is
 * returned straight away; there is nothing a different profile would change
 * about a 404 or a 500.
 */
async function fetchPastBotWall(url: URL, fetcher: Fetcher): Promise<Response> {
  for (let attempt = 0; attempt < FETCH_PROFILES.length; attempt++) {
    let response: Response;
    try {
      response = await fetcher(url.href, {
        redirect: "follow",
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
        headers: fetchProfileForAttempt(attempt).headers,
      });
    } catch {
      throw new Error(`Could not reach ${url.hostname}`);
    }
    const isLastAttempt = attempt === FETCH_PROFILES.length - 1;
    if (response.status !== 403 || isLastAttempt) return response;
  }
  // Unreachable: the loop above always returns on its last iteration.
  throw new Error(`Could not reach ${url.hostname}`);
}

/**
 * GET the page and read a recipe out of it. Throws with a message meant for
 * the import screen when the URL is not http(s), unreachable, an error
 * response, too large, or carries neither structured data nor OpenGraph tags.
 * A 403 that survives both header profiles gets its own message: this is a
 * bot wall headers cannot pass, and the paste box (M34.5) is the way round it.
 */
export async function importRecipeFromUrl(raw: string, fetcher: Fetcher = fetch): Promise<ImportedRecipe> {
  const url = parsePageUrl(raw);
  if (!url) throw new Error("Enter an http or https address");

  const response = await fetchPastBotWall(url, fetcher);
  if (response.status === 403) {
    throw new Error(
      `${url.hostname} is blocking automated requests. Try pasting the recipe text, or the page's HTML (view source, select all, copy), instead.`,
    );
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
