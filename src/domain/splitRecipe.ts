// A whole pasted recipe divided into the parts the editor holds: a title, the
// ingredient lines and the step lines (decision 52). Pure: no IO, importable
// by the client. The step above `parseIngredient`, which reads one line; this
// one decides which lines are ingredients at all.
//
// A paste arrives in one of two shapes. Either it is headed — a line saying
// "Ingredients" and later one saying "Method" — in which case the headings are
// the whole answer and every line belongs to the section named above it. Or it
// is not, and the shape has to be guessed: an ingredient list is a run of
// short lines that mostly start with an amount, and the method is the prose
// after it. `parseQuantity` already knows what "starts with an amount" means,
// so the guess leans on it rather than on a second set of rules.
//
// The guess is deliberately one-way: the leading run of ingredient-looking
// lines is the ingredient block and everything from the first line that is not
// one is steps. A recipe does not go back to listing ingredients after the
// method starts, and a paste that opens with prose ("Preheat the oven to
// 200°C.") has no ingredient block at all rather than a wrong one — a miss the
// review step can fix by moving a line, where a scattered guess cannot be
// fixed at all.
//
// The title is taken first, before either split, because it is the one line
// that belongs to neither list: a short opening line with no amount in it and
// no full stop at the end of it. That rule does eat a first ingredient written
// without an amount ("salt and pepper" as the opening line), which is why the
// title lands in a name field the reviewer can see and empty, not straight
// into the document.
//
// Markers are stripped throughout: a numbered step prefix ("1.", "2)",
// "Step 3:") and a list bullet ("-", "*", "•") are punctuation, not content,
// and neither survives into a row. A heading line never does either.
import { paragraphs } from "./bulkText";
import { parseQuantity } from "./parseQuantity";

/** A paste divided up, markers stripped, blank lines dropped. */
export type SplitRecipe = {
  /** The opening line when it reads like a name rather than a row; else null. */
  title: string | null;
  ingredients: string[];
  steps: string[];
};

/** Which list a heading line opens. */
type Section = "ingredients" | "steps";

/** Heading lines that open the ingredient list. */
const INGREDIENT_HEADINGS = ["ingredients", "ingredient", "you will need", "what you need", "shopping list"];

/** Heading lines that open the step list. */
const STEP_HEADINGS = ["method", "steps", "step", "instructions", "instruction", "directions", "direction", "preparation", "to make"];

/** A line's leading list bullet or numbered-step marker, as a pattern to strip. */
const MARKER = /^\s*(?:[-*•‣▪]|(?:step\s*)?\d+\s*[.):])\s+/i;

/** A line that ends the way a sentence does. */
const SENTENCE_END = /[.!?]["')\]]?$/;

/** A line with any bullet or numbered-step marker removed and the rest trimmed. Pure. */
export function stripMarker(line: string): string {
  return line.replace(MARKER, "").trim();
}

/**
 * The section a line's text names, or null if it names none. A heading is the
 * whole line — "Ingredients", "Ingredients:", "**Method**", "## Ingredients
 * for the pastry" — not a word inside one, so "Add the ingredients" is not a
 * heading. Pure.
 */
export function headingSection(line: string): Section | null {
  const text = line
    .trim()
    .replace(/^#+\s*/, "")
    .replace(/[*_]/g, "")
    .replace(/[:.\s]+$/, "")
    .trim()
    .toLowerCase();
  if (text === "") return null;
  const head = text.split(/\s+for\s+|\s+[–-]\s+/)[0]!.trim();
  if (INGREDIENT_HEADINGS.includes(head)) return "ingredients";
  if (STEP_HEADINGS.includes(head)) return "steps";
  return null;
}

/**
 * Does this line read like an ingredient rather than a step? A leading amount
 * is the strong signal (`parseQuantity`) and shortness is the weak one: an
 * ingredient is a noun phrase, a step is a sentence. A line that ends the way
 * a sentence does is a step whatever else it looks like, unless it opens with
 * an amount and stays short. Pure.
 */
export function looksLikeIngredient(line: string): boolean {
  const text = stripMarker(line);
  if (text === "") return false;
  const words = text.split(/\s+/).length;
  if (parseQuantity(text).quantity !== null && words <= 8) return true;
  if (SENTENCE_END.test(text)) return false;
  if (text.length > 40 || /[.!?]\s/.test(text)) return false;
  return words <= 6;
}

/** Non-blank, marker-stripped lines of a block, in order. Pure. */
function ingredientRows(raw: readonly string[]): string[] {
  return raw.map(stripMarker).filter((line) => line !== "");
}

/**
 * A block's raw lines as step rows. A block whose content is separated by
 * blank lines is one step per paragraph — the shape a recipe pasted as prose
 * arrives in, where one step wraps over several lines. A block with no blank
 * line inside it is one step per line, which is how a numbered method pastes.
 * Markers are stripped either way. Pure.
 */
export function stepRows(raw: readonly string[]): string[] {
  const body = raw.map(stripMarker);
  const first = body.findIndex((line) => line !== "");
  if (first === -1) return [];
  const last = body.length - 1 - [...body].reverse().findIndex((line) => line !== "");
  const inner = body.slice(first, last + 1);
  return inner.includes("") ? paragraphs(inner.join("\n")) : inner;
}

/**
 * The paste's opening line when it reads like a name: not a heading, no
 * leading amount, short, and not punctuated as a sentence. Returns the title
 * and the lines left over. Pure.
 */
function takeTitle(raw: readonly string[]): { title: string | null; rest: readonly string[] } {
  const at = raw.findIndex((line) => line.trim() !== "");
  if (at === -1 || raw.slice(at + 1).every((line) => line.trim() === "")) return { title: null, rest: raw };
  const text = raw[at]!.trim();
  if (headingSection(text) !== null) return { title: null, rest: raw };
  if (parseQuantity(stripMarker(text)).quantity !== null) return { title: null, rest: raw };
  if (SENTENCE_END.test(text) || text.length > 60 || text.split(/\s+/).length > 8) return { title: null, rest: raw };
  if (MARKER.test(raw[at]!)) return { title: null, rest: raw };
  return { title: text.replace(/^#+\s*/, "").replace(/[*_]/g, "").trim(), rest: raw.slice(at + 1) };
}

/**
 * The headed split: every line belongs to the section whose heading was last
 * seen. What comes before the first heading is ingredients when that heading
 * opens the steps (a list that only labels its method) and dropped when it
 * opens the ingredients (a preamble). Returns null when the text carries no
 * heading at all, so the caller can guess instead. Pure.
 */
function splitByHeadings(raw: readonly string[]): Omit<SplitRecipe, "title"> | null {
  const firstHeading = raw.findIndex((line) => headingSection(line) !== null);
  if (firstHeading === -1) return null;
  const buckets: Record<Section, string[]> = { ingredients: [], steps: [] };
  let section: Section | null = headingSection(raw[firstHeading]!) === "steps" ? "ingredients" : null;
  for (const line of raw) {
    const heading = headingSection(line);
    if (heading !== null) {
      section = heading;
      continue;
    }
    if (section !== null) buckets[section].push(line);
  }
  return { ingredients: ingredientRows(buckets.ingredients), steps: stepRows(buckets.steps) };
}

/**
 * The guessed split: the leading run of ingredient-looking lines is the
 * ingredient block, everything from the first line that is not one is steps.
 * Blank lines inside the run do not end it. Pure.
 */
function splitByShape(raw: readonly string[]): Omit<SplitRecipe, "title"> {
  const first = raw.findIndex((line) => stripMarker(line) !== "");
  if (first === -1) return { ingredients: [], steps: [] };
  let end = first;
  if (looksLikeIngredient(raw[first]!)) {
    while (end < raw.length && (stripMarker(raw[end]!) === "" || looksLikeIngredient(raw[end]!))) end += 1;
  }
  return { ingredients: ingredientRows(raw.slice(0, end)), steps: stepRows(raw.slice(end)) };
}

/**
 * A pasted recipe as `{ title, ingredients, steps }`. The opening line becomes
 * the title when it reads like one; headings decide the rest of the split when
 * the paste has any, and otherwise the shape of the lines does. Pure.
 */
export function splitRecipe(text: string): SplitRecipe {
  const { title, rest } = takeTitle(text.split("\n"));
  return { title, ...(splitByHeadings(rest) ?? splitByShape(rest)) };
}
