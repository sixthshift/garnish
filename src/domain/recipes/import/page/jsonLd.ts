/** A parsed `ld+json` object. Values are unknown until something reads them. */
export type JsonLdNode = Record<string, unknown>;

/** `<script type="application/ld+json">`, whatever the attribute order, quoting or casing. */
const LD_SCRIPT = /<script\b[^>]*\btype\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;

// Wrappers some CMSes put around the JSON inside the tag: a CDATA section, an
// HTML comment, and the JavaScript comment guards that often shield the CDATA markers
// from JavaScript parsers. They nest in any combination, so they are stripped
// a layer at a time from both ends until nothing changes. None of these tokens
// can begin or end valid JSON, so this cannot eat into the document.
const WRAPPER_START = /^\s*(?:\/\*|\*\/|<!\[CDATA\[|<!--)\s*/;
const WRAPPER_END = /\s*(?:\/\*|\*\/|\]\]>|-->)\s*$/;

/** The JSON text inside one script tag, with any CDATA, HTML-comment or JavaScript-comment wrapper removed. Pure. */
export function unwrapScriptBody(body: string): string {
  let text = body.trim();
  for (;;) {
    const next = text.replace(WRAPPER_START, "").replace(WRAPPER_END, "");
    if (next === text) return text.trim();
    text = next;
  }
}

/** `value` as a list of objects: itself, its members if it is an array, nothing otherwise. Pure. */
function objects(value: unknown): JsonLdNode[] {
  if (Array.isArray(value)) return value.flatMap(objects);
  if (typeof value === "object" && value !== null) return [value as JsonLdNode];
  return [];
}

/** One parsed value flattened: the node itself, and the members of its `@graph`. Pure. */
function flatten(value: unknown): JsonLdNode[] {
  return objects(value).flatMap((node) => ("@graph" in node ? objects(node["@graph"]) : [node]));
}

/**
 * Every object in every `ld+json` block on the page, in document order, with
 * top-level arrays and `@graph` flattened away. A block whose JSON does not
 * parse is skipped and the rest are kept. Pure.
 */
export function jsonLdNodes(html: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  for (const match of html.matchAll(LD_SCRIPT)) {
    const body = unwrapScriptBody(match[1] ?? "");
    if (body === "") continue;
    try {
      nodes.push(...flatten(JSON.parse(body)));
    } catch {
      // A broken block costs only itself.
    }
  }
  return nodes;
}

/** A node's `@type` as a list, since schema.org allows either a string or an array. Pure. */
export function typesOf(node: JsonLdNode): string[] {
  const type = node["@type"] ?? node.type;
  if (typeof type === "string") return [type];
  if (Array.isArray(type)) return type.filter((entry): entry is string => typeof entry === "string");
  return [];
}

/** Is this node a schema.org Recipe? Case-insensitive, and true for a node typed as several things. Pure. */
export function isRecipeNode(node: JsonLdNode): boolean {
  return typesOf(node).some(
    (type) =>
      type
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\/schema\.org\//, "") === "recipe"
  );
}

/** The first Recipe among the nodes, or null when the page has none. Pure. */
export function findRecipeNode(nodes: readonly JsonLdNode[]): JsonLdNode | null {
  return nodes.find(isRecipeNode) ?? null;
}

/** The page's recipe, straight from its HTML, or null. Pure. */
export function recipeNodeFromHtml(html: string): JsonLdNode | null {
  return findRecipeNode(jsonLdNodes(html));
}
