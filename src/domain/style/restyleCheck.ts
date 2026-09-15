// A restyle may change words but not facts: every number token and food mention in an original part must survive into the restyled one; added numbers are listed, never failed.

import { factsOf, foodsMentioned } from "./facts";

/** A part as this check reads it: enough of the saved `Part` and the editor's `DraftPart` to serve both. */
export type OriginalPart = {
  name: string;
  ingredients: readonly { food?: { name: string; pluralName?: string | null } | null; originalText?: string }[];
  steps: readonly { text: string }[];
};

/** A part as the restyle read answers it: the same part, step texts only. */
export type RestyledPart = {
  name: string;
  steps: readonly string[];
};

/** What the check found for one part. `ok` is the gate; the three lists are what a diff, or a test, reads. */
export type PartRestyleCheck = {
  name: string;
  ok: boolean;
  /** Original number facts the rewrite did not carry at all, each once. */
  missingFacts: string[];
  /** Foods the original steps named that the rewrite no longer names, by the food's own name. */
  missingFoods: string[];
  /** Numbers the rewrite has beyond the original's. Reported, never failed. */
  addedNumbers: string[];
};

/** The whole recipe's verdict: the conjunction, the three lists concatenated, and the parts. */
export type RestyleCheck = {
  ok: boolean;
  missingFacts: string[];
  missingFoods: string[];
  addedNumbers: string[];
  parts: PartRestyleCheck[];
};

/** The original facts the rewrite does not carry at all, and the numbers it has that the original never did. Both as sets, each fact once. */
function factDiff(original: readonly string[], restyled: readonly string[]): { missing: string[]; added: string[] } {
  const had = new Set(original);
  const has = new Set(restyled);
  const missing = [...had].filter((fact) => !has.has(fact));
  const added = [...has].filter((fact) => !had.has(fact));
  return { missing, added };
}

/** One part's verdict: its numbers survived and the foods it named are still named. Pure. */
export function checkPart(original: OriginalPart, restyled: RestyledPart): PartRestyleCheck {
  const originalSteps = original.steps.map((step) => step.text);
  const restyledSteps = [...restyled.steps];

  const { missing, added } = factDiff(factsOf(originalSteps), factsOf(restyledSteps));
  const required = foodsMentioned(originalSteps, original.ingredients);
  const kept = foodsMentioned(restyledSteps, original.ingredients);
  const missingFoods = required.filter((name) => !kept.includes(name));

  return {
    name: original.name,
    ok: missing.length === 0 && missingFoods.length === 0,
    missingFacts: missing,
    missingFoods,
    addedNumbers: added,
  };
}

/**
 * The whole restyle's verdict, part by part. Parts pair by index, which the answer parser
 * guarantees by rejecting any answer with a different count or different names
 * as `malformed`; a mismatch reaching here is a bug rather than a failed check,
 * so it throws instead of returning `ok: false`. Pure.
 */
export function checkRestyle(original: readonly OriginalPart[], restyled: readonly RestyledPart[]): RestyleCheck {
  if (original.length !== restyled.length) {
    throw new Error(`restyle check: ${original.length} original parts against ${restyled.length} restyled`);
  }
  const parts = original.map((part, index) => checkPart(part, restyled[index]!));
  return {
    ok: parts.every((part) => part.ok),
    missingFacts: parts.flatMap((part) => part.missingFacts),
    missingFoods: parts.flatMap((part) => part.missingFoods),
    addedNumbers: parts.flatMap((part) => part.addedNumbers),
    parts,
  };
}
