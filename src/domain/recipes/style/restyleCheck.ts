// A restyle may change words but not what they tell you: every number token, food mention and condition in an original part must survive into the restyled one, and no condition may be invented; added numbers and dropped words are listed, never failed.

import { addedConditions, conditionsOf, contentWordsOf, droppedWords, missingConditions } from "./conservation";
import { factsOf, foodsMentioned, pairedImperial } from "./facts";
import { type ReadingIssue, readingIssues } from "./readability";

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
 * A part as the restyle answers it. `rows` are the ingredient rows it holds, in
 * its order, each named by its place in the recipe's rows read part by part
 * from 0; `notes` is one note per entry of `rows`. The rows themselves are the
 * author's and the pass never sees their quantities to rewrite, so it can move
 * a row to another part, or reorder it, and say how it is prepared, but not
 * change it (decisions.md row 226): naming a row by number is what makes a
 * changed row impossible rather than merely forbidden.
 */
export type RestyledPart = {
  name: string;
  rows: readonly number[];
  notes: readonly string[];
  steps: readonly RestyledStep[];
};

/** Each part's rows as they stand, by their place in the recipe: what an answer that moved nothing says. Pure. */
export function rowsInPlace(parts: readonly { ingredients: readonly unknown[] }[]): number[][] {
  let next = 0;
  return parts.map((part) => part.ingredients.map(() => next++));
}

/**
 * Whether an answer keeps the recipe's parts as they are: as many, with the
 * same names, each holding its own rows in its own order. Such an answer is
 * checked, and chosen, part by part and step by step; any other rebuilt the
 * recipe and is checked, and chosen, whole. Pure.
 */
export function keepsLayout(original: readonly OriginalPart[], restyled: readonly Pick<RestyledPart, "name" | "rows">[]): boolean {
  if (original.length !== restyled.length) return false;
  const fold = (name: string) => name.trim().toLowerCase();
  const inPlace = rowsInPlace(original);
  return original.every(
    (part, p) =>
      fold(part.name) === fold(restyled[p]!.name) &&
      inPlace[p]!.length === restyled[p]!.rows.length &&
      inPlace[p]!.every((row, i) => restyled[p]!.rows[i] === row)
  );
}

/** Whether the answer places every one of `count` rows exactly once, with a note for each. Pure. */
export function placesEveryRow(count: number, restyled: readonly Pick<RestyledPart, "rows" | "notes">[]): boolean {
  const seen = new Set<number>();
  for (const part of restyled) {
    if (part.notes.length !== part.rows.length) return false;
    for (const row of part.rows) {
      if (!Number.isInteger(row) || row < 0 || row >= count || seen.has(row)) return false;
      seen.add(row);
    }
  }
  return seen.size === count;
}

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
  /**
   * Conditions the rewrite states that the author never did, as the rewrite's
   * own clauses. A gate, because an invented cue changes when you stop — "cook
   * the garlic until fragrant" in a recipe that never says so — and adds no
   * number or food for the other checks to see.
   */
  addedConditions: string[];
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

/**
 * The whole recipe's verdict: the conjunction, the lists concatenated, and the
 * parts. `rebuilt` is true when the answer laid the recipe out afresh, and
 * then `parts` holds one verdict over the whole recipe rather than one a part,
 * since a sentence may now sit in a part that did not exist before.
 */
export type RestyleCheck = {
  rebuilt: boolean;
  ok: boolean;
  missingFacts: string[];
  missingFoods: string[];
  missingConditions: string[];
  addedConditions: string[];
  addedNumbers: string[];
  droppedWords: string[];
  rowMismatch: boolean;
  /** What reads wrong though nothing was lost (`readingIssues`). Reported, never failed. */
  issues: ReadingIssue[];
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

/** Every content word the author's recipe uses, prose and ingredient lines, as `contentWordsOf` folds them: what an added condition is measured against. Pure. */
export function recipeWords(parts: readonly OriginalPart[]): Set<string> {
  return new Set(contentWordsOf(parts.flatMap((part) => [...proseOfOriginal(part), ...linesOf(part)])).map((word) => word.key));
}

/**
 * One part's verdict: its numbers and conditions survived, the foods it named
 * are still named, and its ingredient rows still line up. Both sides are read
 * as the whole part rather than as its step text, so content the rewrite moved
 * between a step's label, its supporting line and an ingredient's note is
 * conserved rather than reported lost. Pure.
 */
export function checkPart(original: OriginalPart, restyled: RestyledPart, known: ReadonlySet<string> = recipeWords([original])): PartRestyleCheck {
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
  const invented = addedConditions(conditionsOf(before), conditionsOf(after), known);
  const lostWords = droppedWords(contentWordsOf(before), contentWordsOf(after));
  const rowMismatch = restyled.notes.length !== original.ingredients.length;

  return {
    name: original.name,
    ok: missing.length === 0 && missingFoods.length === 0 && lostConditions.length === 0 && invented.length === 0 && !rowMismatch,
    missingFacts: missing,
    missingFoods,
    missingConditions: lostConditions,
    addedConditions: invented,
    addedNumbers: added,
    droppedWords: lostWords,
    rowMismatch,
  };
}

/** The recipe as one part: every row and every step, in order. What a rebuilt answer is checked against. Pure. */
function wholeOriginal(original: readonly OriginalPart[]): OriginalPart {
  return { name: "", ingredients: original.flatMap((part) => part.ingredients), steps: original.flatMap((part) => part.steps) };
}

/** The answer as one part, its notes put back in the recipe's row order, a row it never placed noted "". Pure. */
function wholeRestyled(count: number, restyled: readonly RestyledPart[]): RestyledPart {
  const notes = Array.from({ length: count }, () => "");
  for (const part of restyled) {
    for (const [i, row] of part.rows.entries()) if (row >= 0 && row < count) notes[row] = part.notes[i] ?? "";
  }
  return { name: "", rows: notes.map((_, i) => i), notes, steps: restyled.flatMap((part) => part.steps) };
}

/**
 * The whole restyle's verdict. An answer that keeps the recipe's layout is
 * checked part by part, so a finding lands on the part, and the step, it is
 * about; one that rebuilt the parts is checked as one recipe, since what a
 * part said may now be said in another. Either way an answer that loses a row,
 * names one twice or names one the recipe does not have fails, as a row
 * mismatch. Pure.
 */
export function checkRestyle(original: readonly OriginalPart[], restyled: readonly RestyledPart[]): RestyleCheck {
  // A cue the rewrite moved from one part into another is the author's, not invented.
  const known = recipeWords(original);
  const count = original.reduce((sum, part) => sum + part.ingredients.length, 0);
  const rebuilt = !keepsLayout(original, restyled);
  const parts = rebuilt
    ? [checkPart(wholeOriginal(original), wholeRestyled(count, restyled), known)]
    : original.map((part, index) => checkPart(part, restyled[index]!, known));
  if (!placesEveryRow(count, restyled)) parts[0] = { ...parts[0]!, ok: false, rowMismatch: true };
  return {
    rebuilt,
    ok: parts.every((part) => part.ok),
    missingFacts: parts.flatMap((part) => part.missingFacts),
    missingFoods: parts.flatMap((part) => part.missingFoods),
    missingConditions: parts.flatMap((part) => part.missingConditions),
    addedConditions: parts.flatMap((part) => part.addedConditions),
    addedNumbers: parts.flatMap((part) => part.addedNumbers),
    droppedWords: parts.flatMap((part) => part.droppedWords),
    rowMismatch: parts.some((part) => part.rowMismatch),
    issues: readingIssues(original, restyled),
    parts,
  };
}
