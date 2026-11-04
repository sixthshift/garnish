import type { JsonLdNode } from "../page/jsonLd";

/** The named HTML entities worth decoding, plus numeric ones. */
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  deg: "°",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
};

/** `&amp;`, `&#39;` and `&#x2019;` as the characters they stand for. Pure. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body.startsWith("#")) {
      const code = body[1] === "x" || body[1] === "X" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * One field as display text: tags stripped, entities decoded, whitespace
 * collapsed. Sites routinely put `<p>` and `<br>` inside a JSON-LD string, and
 * the document stores text, not markup. `<br>` and `</p>` become newlines so a
 * multi-step instruction string can still be split on them. Pure.
 */
export function text(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return "";
  return decodeEntities(
    value
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\s*\/\s*(?:p|div|li|h[1-6])\s*>/gi, "\n")
      .replace(/<[^>]*>/g, "")
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line, index, all) => line !== "" || (index > 0 && index < all.length - 1))
    .join("\n")
    .trim();
}

/** `value` as a list: itself if it is one, a single-item list otherwise, empty for null. Pure. */
export function list(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** A node's field under any of `names`, first one present. Pure. */
export function field(node: JsonLdNode, ...names: string[]): unknown {
  for (const name of names) {
    const value = node[name];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}
