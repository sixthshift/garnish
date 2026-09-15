import { decodeEntities } from "../scraped/text";

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
    // Only `og:` keys: a page's `twitter:title` must never win over its `og:title`.
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
