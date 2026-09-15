// The mechanical check that makes the anchored read safe (M36.5, decisions.md
// row 76). On a page that carried structured data, the JSON-LD already holds
// the recipe's content — every ingredient line, every step, in the site's own
// words — and the one thing it cannot hold is which heading each of them sat
// under, because schema.org has no place to put that. So the model is asked
// for the structure and nothing else, and this is what holds it to that:
// the answer's lines and steps must be the anchor's lines and steps, as
// multisets, or the answer is thrown away.
//
// A multiset rather than a set, and per-collection rather than per-part: a
// recipe that says "salt" twice must still say it twice, and moving a line
// from the main body into "For the sauce" is the whole point of the exercise,
// so order and part membership are exactly what this must not compare. What
// is left is the content, and the content is not the model's to change.
//
// The comparison normalises first — `decodeEntities`, whitespace collapsed,
// trimmed — because those three differences are noise a model introduces
// without meaning to, and rejecting an answer over a non-breaking space would
// discard good structure for nothing. Case and wording are not noise: "Preheat
// the oven" against "Heat the oven" is a reworded step, which is precisely the
// failure this exists to catch.
//
// A failure discards the structure, not the content. `recipe_scrapers` has a
// group rule of the same shape — read the sections, and fall back to the flat
// list when they do not account for the ingredients — with the selectors
// replaced by a model. The caller keeps the anchor as the result and carries
// the rejected answer alongside it, so the review can still offer it to a
// household that can see the model was right.
import { decodeEntities, type ScrapedPart } from "./scraped";

/** What the comparison found. `ok` is the gate; the four lists are what a review, or a test, reads. */
export type ImportCheck = {
  ok: boolean;
  /** Anchor ingredient lines the answer did not account for, with duplicates repeated. */
  missingLines: string[];
  /** Ingredient lines the answer has that the anchor did not, with duplicates repeated. */
  addedLines: string[];
  /** Anchor steps the answer did not account for. */
  missingSteps: string[];
  /** Steps the answer has that the anchor did not. */
  addedSteps: string[];
};

/** One line as it is compared: entities decoded, runs of whitespace collapsed to one space, trimmed. Pure. */
export function normaliseForCheck(line: string): string {
  return decodeEntities(line).replace(/\s+/g, " ").trim();
}

/** Every ingredient line across the parts, normalised. Part boundaries and order are deliberately lost. Pure. */
function lines(parts: readonly ScrapedPart[]): string[] {
  return parts.flatMap((part) => part.ingredients).map(normaliseForCheck);
}

/** Every step across the parts, normalised. Pure. */
function steps(parts: readonly ScrapedPart[]): string[] {
  return parts.flatMap((part) => part.steps).map(normaliseForCheck);
}

/**
 * The two multisets' difference, both ways, in the order the inputs gave. A
 * count per distinct value rather than a sort-and-zip so a line that appears
 * twice on one side and once on the other shows up once as missing. Pure.
 */
function multisetDiff(expected: readonly string[], actual: readonly string[]): { missing: string[]; added: string[] } {
  const counts = new Map<string, number>();
  for (const value of expected) counts.set(value, (counts.get(value) ?? 0) + 1);

  const added: string[] = [];
  for (const value of actual) {
    const remaining = counts.get(value) ?? 0;
    if (remaining > 0) counts.set(value, remaining - 1);
    else added.push(value);
  }

  const missing: string[] = [];
  for (const value of expected) {
    const remaining = counts.get(value) ?? 0;
    if (remaining > 0) {
      missing.push(value);
      counts.set(value, remaining - 1);
    }
  }
  return { missing, added };
}

/**
 * Whether the answer changed the recipe's content. Compares the answer's
 * ingredient lines against the anchor's as a multiset, and its steps likewise,
 * after normalisation; `ok` only when all four difference lists are empty.
 * Pure.
 */
export function checkAgainstAnchor(answer: { parts: readonly ScrapedPart[] }, anchor: { parts: readonly ScrapedPart[] }): ImportCheck {
  const ingredients = multisetDiff(lines(anchor.parts), lines(answer.parts));
  const method = multisetDiff(steps(anchor.parts), steps(answer.parts));
  return {
    ok: ingredients.missing.length === 0 && ingredients.added.length === 0 && method.missing.length === 0 && method.added.length === 0,
    missingLines: ingredients.missing,
    addedLines: ingredients.added,
    missingSteps: method.missing,
    addedSteps: method.added,
  };
}
