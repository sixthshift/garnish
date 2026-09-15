// The anchored read's guard: the answer's lines and steps must equal the anchor's as multisets (entities and whitespace normalised), or its structure is discarded.

import { decodeEntities } from "./scraped/text";
import type { ScrapedPart } from "./scraped/types";

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
