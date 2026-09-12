// A schema.org Recipe node, normalised into the shape the editor can build a
// draft from (M23.3, decisions.md rows 58 and 59). Pure: no IO, importable by
// the client.
//
// schema.org is a vocabulary, not a format. Every field here arrives in
// several shapes because the spec permits several and sites use all of them,
// so every reader below is a funnel rather than a cast:
//
//   image                 a URL, a list of URLs, an ImageObject, a list of them
//   recipeYield           "4", 4, "4 servings", ["4 servings", "4"]
//   keywords              "quick, vegetarian" or ["quick", "vegetarian"]
//   prepTime / cookTime   ISO-8601 ("PT1H30M"), occasionally a bare number
//   recipeInstructions    a string; a list of strings; a list of HowToStep;
//                         a list of HowToSection holding HowToStep
//
// That last one is the only case worth arguing about, and row 59 settles it: a
// `HowToSection` becomes a garnish **part**, named from the section. The
// shapes already match — a section owns an ordered list of steps and has a
// name, which is a part minus its ingredients. Mealie flattens sections into
// one list because its recipe has nowhere to put them; this document does, and
// throwing the structure away would be losing something the page took the
// trouble to say.
//
// Ingredients stay on the unnamed part regardless. schema.org has no way to
// say which section an ingredient belongs to, and guessing from the step text
// is the step-to-ingredient linking that plan.md defers.
//
// Values are read defensively throughout: a field with the wrong type is
// treated as absent rather than throwing, because this input comes off the
// public web and the alternative to a missing field is a failed import.
import type { JsonLdNode } from "./jsonLd";

/** One part of a scraped recipe: a name (empty for the main body) and its steps. */
export type ScrapedPart = { name: string; steps: string[] };

/** A schema.org Recipe as this app's fields. Text only — no ids, nothing resolved. */
export type ScrapedRecipe = {
  name: string;
  description: string;
  /** The first usable image URL, or null. */
  image: string | null;
  /** A number to scale by; 0 when the page did not say. */
  servings: number;
  /** What it makes, minus the count: "muffins", "loaf". Empty when the yield was only a number. */
  yieldText: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  tags: string[];
  /** Raw ingredient lines, for `parseIngredient`. */
  ingredients: string[];
  /** At least one part; the unnamed one is the main body. */
  parts: ScrapedPart[];
};

// --- Text ------------------------------------------------------------------

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
      .replace(/<[^>]*>/g, ""),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line, index, all) => line !== "" || (index > 0 && index < all.length - 1))
    .join("\n")
    .trim();
}

/** `value` as a list: itself if it is one, a single-item list otherwise, empty for null. Pure. */
function list(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** A node's field under any of `names`, first one present. Pure. */
function field(node: JsonLdNode, ...names: string[]): unknown {
  for (const name of names) {
    const value = node[name];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

// --- Fields ----------------------------------------------------------------

/** The first usable URL from a string, a list, an `ImageObject`, or a list of them. Pure. */
export function firstImage(value: unknown): string | null {
  for (const entry of list(value)) {
    if (typeof entry === "string" && entry.trim() !== "") return entry.trim();
    if (typeof entry === "object" && entry !== null) {
      const inner = firstImage((entry as JsonLdNode).url ?? (entry as JsonLdNode).contentUrl);
      if (inner !== null) return inner;
    }
  }
  return null;
}

/** An ISO-8601 duration as whole minutes. Also accepts a bare number of minutes. Years and months are ignored: a recipe has neither. Pure. */
export function durationToMinutes(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw === "") return null;
  if (/^\d+$/.test(raw)) {
    const plain = Number(raw);
    return plain > 0 ? plain : null;
  }
  const match = raw.match(/^P(?:\d+(?:\.\d+)?Y)?(?:\d+(?:\.\d+)?M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!match) return null;
  const [, weeks, days, hours, minutes, seconds] = match;
  const total = Number(weeks ?? 0) * 10080 + Number(days ?? 0) * 1440 + Number(hours ?? 0) * 60 + Number(minutes ?? 0) + Number(seconds ?? 0) / 60;
  return total > 0 ? Math.round(total) : null;
}

/** Words a yield uses for "servings", which say nothing once the number is held separately. */
const GENERIC_YIELD = new Set(["serving", "servings", "serves", "portion", "portions", "person", "people", "yield"]);

/**
 * `recipeYield` as a count to scale by and what it makes. "12 muffins" is 12
 * and "muffins"; "4 servings" is 4 and nothing, because the word adds nothing
 * beside a servings field; a bare "4" is 4 and nothing; "1 loaf" is 1 and
 * "loaf". A list takes the first entry that yields a number, else the first
 * entry at all. Pure.
 */
export function parseYield(value: unknown): { servings: number; yieldText: string } {
  const entries = list(value).map(text).filter((entry) => entry !== "");
  const chosen = entries.find((entry) => /^\s*\d/.test(entry)) ?? entries[0] ?? "";
  const match = chosen.match(/^\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return { servings: 0, yieldText: chosen };
  const rest = (match[2] ?? "").trim();
  return { servings: Number(match[1]), yieldText: GENERIC_YIELD.has(rest.toLowerCase()) ? "" : rest };
}

/** `keywords` as a list: split a comma-separated string, flatten a list, drop blanks and duplicates. Pure. */
export function parseKeywords(value: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of list(value)) {
    const parts = typeof entry === "object" && entry !== null ? [text((entry as JsonLdNode).name)] : text(entry).split(",");
    for (const part of parts) {
      const name = part.trim();
      const key = name.toLowerCase();
      if (name === "" || seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

// --- Instructions ----------------------------------------------------------

/** Is this node a `HowToSection`? Pure. */
function isSection(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const type = (value as JsonLdNode)["@type"];
  return list(type).some((entry) => typeof entry === "string" && entry.trim().toLowerCase().endsWith("howtosection"));
}

/** One instruction entry as its step lines: a string splits on newlines, a `HowToStep` gives its text (or its name). Pure. */
function stepsOfEntry(value: unknown): string[] {
  if (typeof value === "string" || typeof value === "number") {
    return text(value)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
  }
  if (typeof value !== "object" || value === null) return [];
  const node = value as JsonLdNode;
  // A HowToStep carries `text`; some sites put the step in `name` instead, and
  // a few nest an itemListElement of HowToDirection inside one step.
  const inner = list(node.itemListElement).flatMap(stepsOfEntry);
  if (inner.length > 0) return inner;
  const body = text(field(node, "text", "name", "description"));
  return body === "" ? [] : body.split("\n").map((line) => line.trim()).filter((line) => line !== "");
}

/**
 * `recipeInstructions` as parts. A list holding any `HowToSection` becomes one
 * part per section, named from it (row 59), with anything loose collected into
 * the unnamed main body; anything else is one unnamed part holding every step.
 * Always returns at least one part, so the draft it builds validates. Pure.
 */
export function partsFromInstructions(value: unknown): ScrapedPart[] {
  const entries = list(value);
  if (!entries.some(isSection)) {
    return [{ name: "", steps: entries.flatMap(stepsOfEntry) }];
  }
  const parts: ScrapedPart[] = [];
  const loose: string[] = [];
  for (const entry of entries) {
    if (!isSection(entry)) {
      loose.push(...stepsOfEntry(entry));
      continue;
    }
    const node = entry as JsonLdNode;
    const steps = list(node.itemListElement).flatMap(stepsOfEntry);
    if (steps.length === 0) continue;
    parts.push({ name: text(field(node, "name", "headline")), steps });
  }
  // The main body goes first, as the view page prints it.
  if (loose.length > 0 || parts.length === 0) parts.unshift({ name: "", steps: loose });
  return parts;
}

// --- The whole node --------------------------------------------------------

/**
 * A schema.org Recipe node as a `ScrapedRecipe`. Every field is optional on
 * the way in; what the page did not say comes back empty rather than missing,
 * so the review screen has something to render for each one. Pure.
 */
export function scrapedFromSchema(node: JsonLdNode): ScrapedRecipe {
  const { servings, yieldText } = parseYield(field(node, "recipeYield", "yield"));
  return {
    name: text(field(node, "name", "headline")),
    description: text(node.description),
    image: firstImage(field(node, "image", "thumbnailUrl")),
    servings,
    yieldText,
    prepMinutes: durationToMinutes(node.prepTime),
    cookMinutes: durationToMinutes(field(node, "cookTime", "performTime")),
    tags: parseKeywords(field(node, "keywords", "recipeCategory")),
    ingredients: list(field(node, "recipeIngredient", "ingredients")).map(text).filter((line) => line !== ""),
    parts: partsFromInstructions(field(node, "recipeInstructions", "instructions")),
  };
}

/** Did the page actually give us a recipe, or only a name? What decides whether the OpenGraph rung is needed. Pure. */
export function hasContent(scraped: ScrapedRecipe): boolean {
  return scraped.ingredients.length > 0 || scraped.parts.some((part) => part.steps.length > 0);
}
