// A restyle may change words but not what they tell you: every number token, food mention and condition in an original part must survive into the restyled one; added numbers and dropped words are listed, never failed.

import { conditionsOf, contentWordsOf, droppedWords, missingConditions } from "./conservation";
import { factsOf, foodsMentioned, pairedImperial } from "./facts";

/** A part as this check reads it: enough of the saved `Part` and the editor's `DraftPart` to serve both. */
export type OriginalPart = {
  name: string;
  ingredients: readonly {
    food?: { name: string; pluralName?: string | null } | null;
    originalText?: string;
    note?: string;
    /** The row as the page renders it ("200 g spaghetti"), where the caller can format one; `originalText` otherwise. */
    line?: string;
  }[];
  steps: readonly { title?: string; text: string; summary?: string }[];
};

/** A step as the restyle answers it: the label, the instruction, and the supporting line. */
export type RestyledStep = { title: string; text: string; summary: string };

/**
 * A part as the restyle answers it. `notes` is one note per ingredient row, in
 * the part's own order — the rows themselves are the author's and the pass
 * never sees their quantities, so a note is the only thing it can say about
 * one, and saying it by position is what makes a changed row impossible rather
 * than merely forbidden.
 */
export type RestyledPart = {
  name: string;
  notes: readonly string[];
  steps: readonly RestyledStep[];
};

/**
 * Everything a part says, in one bag: the label, the instruction and the
 * supporting line of each step, then the ingredient notes. Conservation is
 * over the document rather than over the step text, so a sentence the rewrite
 * moved from a step into a note — "finely dice the onion" becoming "onion,
 * finely diced" — is kept rather than reported as lost. Pure.
 */
export function proseOfOriginal(part: OriginalPart): string[] {
  return [...part.steps.flatMap((step) => [step.title ?? "", step.text, step.summary ?? ""]), ...part.ingredients.map((row) => row.note ?? "")].filter(
    (text) => text.trim() !== ""
  );
}

/** The same bag for a part the restyle answered. Pure. */
export function proseOfRestyled(part: RestyledPart): string[] {
  return [...part.steps.flatMap((step) => [step.title, step.text, step.summary]), ...part.notes].filter((text) => text.trim() !== "");
}

/**
 * The part's ingredient lines, which belong to the document on both sides: the
 * pass is never shown a quantity, a unit or a food to rewrite, so these are the
 * same before and after by construction. They are read with the prose because a
 * step that said "cut 200g bacon into pieces" and a rewrite that says "cut the
 * bacon into pieces" have not lost the 200 g — the row still holds it, and the
 * house style asks for exactly that move. Pure.
 */
export function linesOf(part: OriginalPart): string[] {
  return part.ingredients.map((row) => row.line ?? row.originalText ?? "").filter((line) => line.trim() !== "");
}

/** "(if using)" and its kin: a condition about whether an ingredient is in the recipe at all, rather than about what to do with it. */
const IF_USING = /^if using\b/u;

/**
 * Whether a lost condition is an "(if using)" that the rewrite moved onto an
 * ingredient's line, which the style asks for: optionality belongs to the row,
 * not to the sentence, and "optional" beside the food says what "(if using)"
 * said. Any other condition is about the method and has nowhere else to live.
 * Pure.
 */
function movedToOptional(phrase: string, restyled: RestyledPart): boolean {
  return IF_USING.test(phrase.trim().toLowerCase()) && restyled.notes.some((note) => /\boptional\b/iu.test(note));
}

/** What the check found for one part. `ok` is the gate; the lists are what a diff, or a test, reads. */
export type PartRestyleCheck = {
  name: string;
  ok: boolean;
  /** Original number facts the rewrite did not carry at all, each once. */
  missingFacts: string[];
  /** Foods the original steps named that the rewrite no longer names, by the food's own name. */
  missingFoods: string[];
  /**
   * Conditions the rewrite no longer states, as the author's own clauses. A
   * gate, because a dropped "if" does not drop a number or a food and so is
   * invisible to the other two: "add sugar if the sauce is sour" becoming
   * "add sugar" passed every check this one did not exist beside.
   */
  missingConditions: string[];
  /** Numbers the rewrite has beyond the original's. Reported, never failed. */
  addedNumbers: string[];
  /** Words the author used that the rewrite does not. Reported, never failed: a house style rewords by design. */
  droppedWords: string[];
  /**
   * The ingredient rows the answer does not line up with, when its `notes` are
   * a different count from the part's rows. A gate, and the one check that is
   * about the answer's shape rather than its content: a note written against
   * the wrong row is a quantity attached to the wrong food.
   */
  rowMismatch: boolean;
};

/** The whole recipe's verdict: the conjunction, the three lists concatenated, and the parts. */
export type RestyleCheck = {
  ok: boolean;
  missingFacts: string[];
  missingFoods: string[];
  missingConditions: string[];
  addedNumbers: string[];
  droppedWords: string[];
  rowMismatch: boolean;
  parts: PartRestyleCheck[];
};

/**
 * The original facts the rewrite does not carry at all, and the numbers it has
 * that the original never did. Both as sets, each fact once. An imperial figure
 * written beside its metric twin is not counted as missing: it is the same
 * quantity said twice, and the metric statement drops it on purpose.
 */
function factDiff(original: readonly string[], restyled: readonly string[]): { missing: string[]; added: string[] } {
  const had = new Set(factsOf(original));
  const has = new Set(factsOf(restyled));
  const paired = pairedImperial(original);
  const missing = [...had].filter((fact) => !has.has(fact) && !paired.has(fact));
  const added = [...has].filter((fact) => !had.has(fact));
  return { missing, added };
}

/**
 * One part's verdict: its numbers and conditions survived, the foods it named
 * are still named, and its ingredient rows still line up. Both sides are read
 * as the whole part rather than as its step text, so content the rewrite moved
 * between a step's label, its supporting line and an ingredient's note is
 * conserved rather than reported lost. Pure.
 */
export function checkPart(original: OriginalPart, restyled: RestyledPart): PartRestyleCheck {
  const before = proseOfOriginal(original);
  const after = proseOfRestyled(restyled);
  // The rows join the facts alone. They cannot change, so they are the same on
  // both sides — but the foods check asks whether the *method* still names an
  // ingredient, and every row names its own food, so reading them there would
  // pass every rewrite.
  const lines = linesOf(original);
  const { missing, added } = factDiff([...before, ...lines], [...after, ...lines]);
  const required = foodsMentioned(before, original.ingredients);
  const kept = foodsMentioned(after, original.ingredients);
  const missingFoods = required.filter((name) => !kept.includes(name));
  const lostConditions = missingConditions(conditionsOf(before), conditionsOf(after)).filter((phrase) => !movedToOptional(phrase, restyled));
  const lostWords = droppedWords(contentWordsOf(before), contentWordsOf(after));
  const rowMismatch = restyled.notes.length !== original.ingredients.length;

  return {
    name: original.name,
    ok: missing.length === 0 && missingFoods.length === 0 && lostConditions.length === 0 && !rowMismatch,
    missingFacts: missing,
    missingFoods,
    missingConditions: lostConditions,
    addedNumbers: added,
    droppedWords: lostWords,
    rowMismatch,
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
    missingConditions: parts.flatMap((part) => part.missingConditions),
    addedNumbers: parts.flatMap((part) => part.addedNumbers),
    droppedWords: parts.flatMap((part) => part.droppedWords),
    rowMismatch: parts.some((part) => part.rowMismatch),
    parts,
  };
}
