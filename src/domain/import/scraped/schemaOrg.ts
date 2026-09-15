import type { JsonLdNode } from "../page/jsonLd";
import { tidyParts } from "./parts";
import { field, list, text } from "./text";
import type { ScrapedPart, ScrapedRecipe } from "./types";
import { parseYield } from "./yield";

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
  const match = raw.match(
    /^P(?:\d+(?:\.\d+)?Y)?(?:\d+(?:\.\d+)?M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i
  );
  if (!match) return null;
  const [, weeks, days, hours, minutes, seconds] = match;
  const total = Number(weeks ?? 0) * 10080 + Number(days ?? 0) * 1440 + Number(hours ?? 0) * 60 + Number(minutes ?? 0) + Number(seconds ?? 0) / 60;
  return total > 0 ? Math.round(total) : null;
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
  return body === ""
    ? []
    : body
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "");
}

/**
 * `recipeInstructions` as parts. A list holding any `HowToSection` becomes one
 * part per section, named from it, with anything loose collected into
 * the unnamed main body; anything else is one unnamed part holding every step.
 * Always returns at least one part, so the draft it builds validates. Pure.
 */
export function partsFromInstructions(value: unknown): ScrapedPart[] {
  const entries = list(value);
  if (!entries.some(isSection)) {
    return [{ name: "", ingredients: [], steps: entries.flatMap(stepsOfEntry) }];
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
    parts.push({ name: text(field(node, "name", "headline")), ingredients: [], steps });
  }
  // The main body goes first, as the view page prints it.
  if (loose.length > 0 || parts.length === 0) parts.unshift({ name: "", ingredients: [], steps: loose });
  // Tidied here as well as in `normaliseScraped`, because a page's
  // sections reach the draft through this function without passing through
  // that one, and a part name should read the same whichever rung found it.
  return tidyParts(parts);
}

// --- The whole node --------------------------------------------------------

/**
 * A schema.org Recipe node as a `ScrapedRecipe`. Every field is optional on
 * the way in; what the page did not say comes back empty rather than missing,
 * so the review screen has something to render for each one. Pure.
 */
export function scrapedFromSchema(node: JsonLdNode): ScrapedRecipe {
  const { servings, yieldText } = parseYield(field(node, "recipeYield", "yield"));
  const parts = partsFromInstructions(field(node, "recipeInstructions", "instructions"));
  const lines = list(field(node, "recipeIngredient", "ingredients"))
    .map(text)
    .filter((line) => line !== "");
  // Every line on the unnamed part, because that is the whole of what the page
  // said: a `recipeIngredient` carries no section, whatever headings the page
  // draws around it. A recipe of nothing but named sections gains an unnamed
  // body to hold them rather than having them guessed onto one of the sections.
  const main = parts.find((part) => part.name === "");
  if (main !== undefined) main.ingredients = lines;
  else if (lines.length > 0) parts.unshift({ name: "", ingredients: lines, steps: [] });
  return {
    name: text(field(node, "name", "headline")),
    description: text(node.description),
    image: firstImage(field(node, "image", "thumbnailUrl")),
    servings,
    yieldText,
    prepMinutes: durationToMinutes(node.prepTime),
    // A page with only `totalTime` — BBC Good Food is one — would otherwise
    // lose its timing entirely. Read it as the cook time: this document has no
    // total of its own (it derives one from these two),
    // and putting the page's total here makes the total it shows correct. Only
    // as a fallback, so a page that states both is taken at its word.
    cookMinutes: durationToMinutes(field(node, "cookTime", "performTime")) ?? durationToMinutes(node.totalTime),
    tags: parseKeywords(field(node, "keywords", "recipeCategory")),
    parts,
  };
}
