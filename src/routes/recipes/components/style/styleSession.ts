// The Style space's model: the author's parts, the restyle's answer, and the household's choices between them, step by step. Pure.

import { formatIngredient } from "../../../../domain/ingredient";
import { checkRestyle, type OriginalPart, type PartRestyleCheck, type RestyleCheck, type RestyledPart, type RestyledStep } from "../../../../domain/style";

/** What the restyle answers: the rewritten parts and the check over them, as `restyleSteps` and `restyleDraft` return it. */
export type StyleAnswer = { parts: RestyledPart[]; check: RestyleCheck };

/** Which side of a step, or of a whole part, the household is taking. */
export type Choice = "rewrite" | "original";

/**
 * The household's choices. A part whose rewrite kept the author's step count is
 * chosen step by step (`steps`, keyed by `stepKey`); a part whose rewrite merged
 * or split steps has no step to pair with another, so it is chosen whole
 * (`parts`). `edits` are rewritten step texts retyped in place, by the same key.
 */
export type StyleChoices = {
  steps: Readonly<Record<string, Choice>>;
  parts: Readonly<Record<number, Choice>>;
  edits: Readonly<Record<string, string>>;
};

/** One thing the check found, worded for the step or part it is shown on. */
export type Finding = { kind: "condition" | "fact" | "food" | "rows"; item: string; message: string };

/** The key of step `step` of part `part` in `StyleChoices`. */
export function stepKey(part: number, step: number): string {
  return `${part}.${step}`;
}

/** A part as the check reads it, from a saved recipe or a draft: each row carrying the line the page renders. */
export function styleOriginal(
  parts: readonly {
    name: string;
    ingredients: readonly Parameters<typeof formatIngredient>[0][];
    steps: readonly { title?: string; text: string; summary?: string }[];
  }[]
): OriginalPart[] {
  return parts.map((part) => ({
    name: part.name,
    ingredients: part.ingredients.map((row) => ({ ...row, line: formatIngredient(row).trim() || row.originalText })),
    steps: part.steps.map((step) => ({ title: step.title ?? "", text: step.text, summary: step.summary ?? "" })),
  }));
}

/** Whether a part can be chosen step by step: the rewrite kept the author's steps one for one. */
export function isAligned(original: OriginalPart, rewrite: RestyledPart): boolean {
  return original.steps.length > 0 && original.steps.length === rewrite.steps.length;
}

/** Whether a rewritten step says exactly what the author's did, so there is nothing to choose between. */
export function sameStep(original: OriginalPart["steps"][number], rewrite: RestyledStep): boolean {
  const fold = (value: string | undefined) => (value ?? "").trim();
  return fold(original.title) === fold(rewrite.title) && fold(original.text) === fold(rewrite.text) && fold(original.summary) === fold(rewrite.summary);
}

/** The words of a finding, as the step or part it is shown on says them. */
export function findingMessage(kind: Finding["kind"], item: string): string {
  switch (kind) {
    case "condition":
      return `“${item}” is in the original but not in the rewrite.`;
    case "fact":
      return `The original’s “${item}” is not in the rewrite.`;
    case "food":
      return `The rewrite no longer names ${item}.`;
    case "rows":
      return "The rewrite’s notes do not line up with this part’s ingredients.";
  }
}

/** Everything one of the author's steps says, folded for a search. */
function stepProse(step: OriginalPart["steps"][number]): string {
  return [step.title ?? "", step.text, step.summary ?? ""].join(" ").toLowerCase();
}

/**
 * The part's findings placed on the author's step each came from, so the
 * warning sits beside the words it is about. The check is over the whole part
 * — content may move between steps and into notes — so a finding no step
 * contains, one in a part chosen whole, and a row mismatch stay on the part.
 */
export function partFindings(original: OriginalPart, check: PartRestyleCheck, aligned: boolean): { steps: Finding[][]; part: Finding[] } {
  const steps: Finding[][] = original.steps.map(() => []);
  const part: Finding[] = [];
  const items: [Finding["kind"], string][] = [
    ...check.missingConditions.map((item) => ["condition", item] as [Finding["kind"], string]),
    ...check.missingFacts.map((item) => ["fact", item] as [Finding["kind"], string]),
    ...check.missingFoods.map((item) => ["food", item] as [Finding["kind"], string]),
  ];
  for (const [kind, item] of items) {
    const finding = { kind, item, message: findingMessage(kind, item) };
    const at = aligned ? original.steps.findIndex((step) => stepProse(step).includes(item.toLowerCase())) : -1;
    if (at === -1) part.push(finding);
    else steps[at]!.push(finding);
  }
  if (check.rowMismatch) part.push({ kind: "rows", item: "", message: findingMessage("rows", "") });
  return { steps, part };
}

/** The author's words the rewrite of each step no longer uses, placed as `partFindings` places findings. Reported, never failed. */
export function stepDroppedWords(original: OriginalPart, check: PartRestyleCheck): string[][] {
  const words: string[][] = original.steps.map(() => []);
  for (const word of check.droppedWords) {
    const at = original.steps.findIndex((step) => stepProse(step).includes(word.toLowerCase()));
    if (at !== -1) words[at]!.push(word);
  }
  return words;
}

/**
 * Where each step starts: on the rewrite, unless the check found something in
 * it, which starts it on the author's words until someone chooses otherwise.
 * A finding the part holds as a whole starts the whole part on the original.
 */
export function initialChoices(original: readonly OriginalPart[], answer: StyleAnswer): StyleChoices {
  const steps: Record<string, Choice> = {};
  const parts: Record<number, Choice> = {};
  original.forEach((part, p) => {
    const rewrite = answer.parts[p]!;
    const aligned = isAligned(part, rewrite);
    const findings = partFindings(part, answer.check.parts[p]!, aligned);
    const whole: Choice = findings.part.length > 0 ? "original" : "rewrite";
    parts[p] = whole;
    if (aligned) {
      part.steps.forEach((_, s) => {
        steps[stepKey(p, s)] = whole === "original" || findings.steps[s]!.length > 0 ? "original" : "rewrite";
      });
    }
  });
  return { steps, parts, edits: {} };
}

/** Every step of part `p` on one side: "Keep all" and "Use all original". */
export function choosePart(choices: StyleChoices, original: readonly OriginalPart[], answer: StyleAnswer, p: number, choice: Choice): StyleChoices {
  const steps = { ...choices.steps };
  if (isAligned(original[p]!, answer.parts[p]!)) {
    original[p]!.steps.forEach((_, s) => {
      steps[stepKey(p, s)] = choice;
    });
  }
  return { ...choices, steps, parts: { ...choices.parts, [p]: choice } };
}

/** Whether the household is taking the rewrite of step `s` of part `p` (of the rewrite's own step, for a part chosen whole). */
export function takesRewrite(choices: StyleChoices, original: readonly OriginalPart[], answer: StyleAnswer, p: number, s: number): boolean {
  return isAligned(original[p]!, answer.parts[p]!) ? choices.steps[stepKey(p, s)] === "rewrite" : choices.parts[p] === "rewrite";
}

/** The author's step in the answer's shape. */
function asRestyled(step: OriginalPart["steps"][number]): RestyledStep {
  return { title: step.title ?? "", text: step.text, summary: step.summary ?? "" };
}

/** A rewritten step with its retyped text, if it was retyped. */
function edited(step: RestyledStep, choices: StyleChoices, key: string): RestyledStep {
  const text = choices.edits[key];
  return text === undefined ? { ...step } : { ...step, text };
}

/**
 * The parts to save, in the answer's shape and the recipe's order: each step
 * the side chosen for it, and a part's notes the rewrite's whenever any of its
 * rewrite is taken, since preparation the rewrite moved out of a step lives in
 * those notes. What `applyRestyle` and `createRestyledRecipe` take.
 */
export function assemble(original: readonly OriginalPart[], answer: StyleAnswer, choices: StyleChoices): RestyledPart[] {
  return original.map((part, p) => {
    const rewrite = answer.parts[p]!;
    const notes = part.ingredients.map((row) => row.note ?? "");
    if (part.steps.length === 0 && rewrite.steps.length === 0) return { name: part.name, notes: [...rewrite.notes], steps: [] };
    if (isAligned(part, rewrite)) {
      const steps = part.steps.map((step, s) =>
        takesRewrite(choices, original, answer, p, s) ? edited(rewrite.steps[s]!, choices, stepKey(p, s)) : asRestyled(step)
      );
      const anyRewrite = part.steps.some((_, s) => takesRewrite(choices, original, answer, p, s));
      return { name: part.name, notes: anyRewrite ? [...rewrite.notes] : notes, steps };
    }
    if (choices.parts[p] === "rewrite") {
      return { name: part.name, notes: [...rewrite.notes], steps: rewrite.steps.map((step, s) => edited(step, choices, stepKey(p, s))) };
    }
    return { name: part.name, notes, steps: part.steps.map(asRestyled) };
  });
}

/** Whether the assembled parts say anything the author's do not: false when every choice is the original, so there is nothing to write. */
export function changesAnything(original: readonly OriginalPart[], assembled: readonly RestyledPart[]): boolean {
  return original.some((part, p) => {
    const next = assembled[p]!;
    if (next.steps.length !== part.steps.length) return true;
    if (next.steps.some((step, s) => !sameStep(part.steps[s]!, step))) return true;
    return next.notes.some((note, i) => note.trim() !== (part.ingredients[i]?.note ?? "").trim());
  });
}

/**
 * The same check the restyle ran, over what will actually be saved. A mix of
 * rewritten and original steps can lose a sentence the rewrite moved from one
 * step to another, which neither step's own finding shows; this does.
 */
export function checkChoices(original: readonly OriginalPart[], assembled: readonly RestyledPart[]): RestyleCheck {
  return checkRestyle(original, assembled);
}

/** The status line's numbers: how many choices there are, how many take the rewrite, and how many carry a finding. */
export function choiceCounts(original: readonly OriginalPart[], answer: StyleAnswer, choices: StyleChoices): { total: number; kept: number; flagged: number } {
  let total = 0;
  let kept = 0;
  let flagged = 0;
  original.forEach((part, p) => {
    const rewrite = answer.parts[p]!;
    if (rewrite.steps.length === 0) return;
    const aligned = isAligned(part, rewrite);
    const findings = partFindings(part, answer.check.parts[p]!, aligned);
    if (aligned) {
      part.steps.forEach((step, s) => {
        if (sameStep(step, rewrite.steps[s]!)) return;
        total += 1;
        if (takesRewrite(choices, original, answer, p, s)) kept += 1;
        if (findings.steps[s]!.length > 0 || findings.part.length > 0) flagged += 1;
      });
    } else {
      total += 1;
      if (choices.parts[p] === "rewrite") kept += 1;
      if (findings.part.length > 0) flagged += 1;
    }
  });
  return { total, kept, flagged };
}
