// A page's OpenGraph tags, the last rung of the URL import (M23.4,
// decisions.md row 58). Pure: no IO, no DOM.
//
// This is Mealie's `RecipeScraperOpenGraph`, and the point of it is honesty. A
// page with no schema.org Recipe has not given us a recipe and no amount of
// rules will find one, so rather than erroring the way Tandoor does, the
// import falls back to what every page does carry — a title, a description and
// a share image — and hands over a named, illustrated, linked shell with empty
// lists. You type the recipe in, but you type it into something that already
// knows what it is and where it came from.
//
// Mealie fills its ingredient list with the literal string "Could not detect
// ingredients". This leaves the lists empty instead: an empty list is a state
// the editor already draws well, and a row that has to be deleted before you
// can start is worse than no row.
//
// Read with a regular expression for the same reason `jsonLd.ts` is: one
// element, two attributes, and `<meta>` is void so there is no nesting to get
// wrong. `property` is what OpenGraph specifies and `name` is what a good
// number of sites emit instead, so both are accepted — but only for `og:`
// keys, never `twitter:`, whose `twitter:title` would otherwise win on a page
// that has both.
import { decodeEntities } from "../scraped";

/** What a page gives up when it has no structured recipe data. */
export type OpenGraphStub = {
  name: string;
  description: string;
  image: string | null;
};

/** A `<meta>` tag, capturing its whole attribute list. */
const META = /<meta\b([^>]*)>/gi;

/** One attribute out of a tag's attribute list, quoted or not. Pure. */
function attribute(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"));
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? null;
}

/**
 * Every `og:*` value on the page, keyed by the part after `og:`, first
 * occurrence winning — OpenGraph allows repeats and the first is the primary.
 * Pure.
 */
export function openGraphTags(html: string): Map<string, string> {
  const tags = new Map<string, string>();
  for (const match of html.matchAll(META)) {
    const attrs = match[1] ?? "";
    const key = attribute(attrs, "property") ?? attribute(attrs, "name");
    if (key === null) continue;
    const normalised = key.trim().toLowerCase();
    if (!normalised.startsWith("og:")) continue;
    const stripped = normalised.slice(3);
    if (tags.has(stripped)) continue;
    const value = attribute(attrs, "content");
    if (value === null) continue;
    const content = decodeEntities(value).replace(/\s+/g, " ").trim();
    if (content === "") continue;
    tags.set(stripped, content);
  }
  return tags;
}

/**
 * The page as a stub, or null when it does not even have a title — at which
 * point there is nothing to build a recipe around and the import should say
 * so rather than create an untitled shell. Pure.
 */
export function openGraphStub(html: string): OpenGraphStub | null {
  const tags = openGraphTags(html);
  const name = tags.get("title") ?? "";
  if (name === "") return null;
  return { name, description: tags.get("description") ?? "", image: tags.get("image") ?? null };
}
