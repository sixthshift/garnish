import { decodeEntities } from "../scraped/text";
import { findRecipeNode, type JsonLdNode } from "./jsonLd";
import { BLOCK_TAGS } from "./text";

// Microdata is schema.org's vocabulary written as HTML attributes instead of a
// JSON block: `itemscope` opens an item, `itemtype` names it, `itemprop` hangs
// a value or a nested item on the nearest enclosing one. This reads it into the
// same node shape `jsonLd.ts` produces, so `scrapedFromSchema` takes either
// without knowing which it was handed. Older recipe plugins and some CMSes
// still write it and no `ld+json` at all.

/** One tag: closing slash, name, attribute list, self-closing slash. Quoted values may hold `>`. */
const TAG = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g;

/** One attribute in an attribute list, valued or bare. */
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

/** Elements that never have a closing tag, so are never pushed. */
const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/** Elements a page often leaves open, closed by the next of their kind. */
const SELF_ENDING = new Set(["li", "p", "dt", "dd", "tr", "td", "th", "option"]);

/** Where an `itemprop`'s value comes from when it is not the element's text, by tag. */
const URL_ATTRIBUTE: Record<string, string> = {
  a: "href",
  area: "href",
  link: "href",
  img: "src",
  audio: "src",
  embed: "src",
  iframe: "src",
  source: "src",
  track: "src",
  video: "src",
  object: "data",
};

/** A tag's attributes by lower-cased name, values decoded; a bare attribute is the empty string. Pure. */
function attributesOf(list: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of list.matchAll(ATTRIBUTE)) {
    const name = match[1]!.toLowerCase();
    if (!attributes.has(name)) attributes.set(name, decodeEntities(match[2] ?? match[3] ?? match[4] ?? ""));
  }
  return attributes;
}

/** `itemtype` as bare type names: `https://schema.org/Recipe` is `Recipe`, as the JSON-LD reader would see it. Pure. */
function typeNames(itemtype: string): string[] {
  return itemtype
    .split(/\s+/)
    .filter((url) => url !== "")
    .map((url) => url.replace(/\/+$/, "").split(/[/#]/).pop() ?? url);
}

/** A value an element gives without reading its text, or null when its text is the value. Pure. */
function attributeValue(tag: string, attributes: Map<string, string>): string | null {
  // `content` is not in the microdata spec for anything but `meta`, but recipe
  // plugins put it on spans (`<span itemprop="prepTime" content="PT20M">20 min</span>`)
  // and it is the machine-readable value when it is there.
  const content = attributes.get("content");
  if (content !== undefined) return content;
  const url = URL_ATTRIBUTE[tag];
  if (url !== undefined) return attributes.get(url) ?? "";
  if (tag === "time") return attributes.get("datetime") ?? null;
  if (tag === "data" || tag === "meter") return attributes.get("value") ?? null;
  return null;
}

/** A property's values while it is being read: a slot per occurrence, filled at open or close. */
type Building = Map<string, unknown[]>;

/** A built item as a node: `@type` from `itemtype`, a property seen once as its value, seen more as a list. Pure. */
function finish(types: string[], building: Building, done: Map<Building, JsonLdNode>): JsonLdNode {
  const node: JsonLdNode = types.length === 0 ? {} : { "@type": types.length === 1 ? types[0] : types };
  for (const [name, values] of building) {
    const resolved = values.map((value) => (value instanceof Map ? (done.get(value as Building) ?? {}) : value));
    node[name] = resolved.length === 1 ? resolved[0] : resolved;
  }
  return node;
}

/** An open element: its tag, the item it opens if any, and the text slots it fills when it closes. */
type Open = { tag: string; item: { types: string[]; building: Building } | null; slots: { values: unknown[]; index: number }[]; textStart: number };

/**
 * Every microdata item on the page, nested ones included, in document order,
 * as JSON-LD-shaped nodes: a nested item is both its parent's property value
 * and a member of the list, the way `@graph` is flattened for JSON-LD.
 * `itemref` is not followed. Pure — a tag scanner, no DOM: a page's
 * unclosed `<li>` and `<p>` are closed by the next one, and a closing tag
 * with no open partner is ignored.
 */
export function microdataNodes(html: string): JsonLdNode[] {
  const source = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  if (!/\bitemscope\b/i.test(source)) return [];

  const stack: Open[] = [];
  const items: { types: string[]; building: Building }[] = [];
  let text = "";

  const close = (open: Open) => {
    const value = text.slice(open.textStart).trim();
    for (const slot of open.slots) slot.values[slot.index] = value;
    if (BLOCK_TAGS.has(open.tag)) text += "\n";
  };
  const closeTo = (depth: number) => {
    while (stack.length > depth) close(stack.pop()!);
  };

  let lastIndex = 0;
  TAG.lastIndex = 0;
  for (let match = TAG.exec(source); match !== null; match = TAG.exec(source)) {
    text += source.slice(lastIndex, match.index);
    lastIndex = TAG.lastIndex;
    const tag = match[2]!.toLowerCase();

    if (match[1] === "/") {
      const depth = stack.findLastIndex((open) => open.tag === tag);
      if (depth !== -1) closeTo(depth);
      continue;
    }

    if (SELF_ENDING.has(tag) && stack.at(-1)?.tag === tag) closeTo(stack.length - 1);
    if (tag === "br" || tag === "li") text += "\n";

    const attributes = attributesOf(match[3] ?? "");
    const owner = stack.findLast((open) => open.item !== null)?.item ?? null;
    const props = (attributes.get("itemprop") ?? "").split(/\s+/).filter((name) => name !== "");
    const scope = attributes.has("itemscope") ? { types: typeNames(attributes.get("itemtype") ?? ""), building: new Map() as Building } : null;
    if (scope !== null) items.push(scope);

    const open: Open = { tag, item: scope, slots: [], textStart: text.length };
    if (owner !== null) {
      const fixed = scope === null ? attributeValue(tag, attributes) : null;
      for (const name of props) {
        const values = owner.building.get(name) ?? [];
        owner.building.set(name, values);
        // A nested item is its building map until the end, when it is swapped for its node.
        if (scope !== null) values.push(scope.building);
        else if (fixed !== null) values.push(fixed);
        else open.slots.push({ values, index: values.push("") - 1 });
      }
    }

    const selfClosed = match[4] === "/" || VOID_TAGS.has(tag);
    if (!selfClosed) stack.push(open);
    else if (BLOCK_TAGS.has(tag)) text += "\n";
  }
  text += source.slice(lastIndex);
  closeTo(0);

  // Innermost first, so a parent's nested building maps all have their nodes.
  const done = new Map<Building, JsonLdNode>();
  for (const item of [...items].reverse()) done.set(item.building, finish(item.types, item.building, done));
  return items.map((item) => done.get(item.building)!);
}

/** The page's microdata Recipe, or null. Pure. */
export function recipeNodeFromMicrodata(html: string): JsonLdNode | null {
  return findRecipeNode(microdataNodes(html));
}
