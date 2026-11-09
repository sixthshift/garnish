// The Style space's model: the author's parts, the restyle's answer, and which of the two the household saves. Pure.

import { formatIngredient } from "../../ingredient";
import {
  checkRestyle,
  keepsLayout,
  type OriginalPart,
  type PartRestyleCheck,
  type RestyleCheck,
  type RestyledPart,
  type RestyledStep,
  rowsInPlace,
} from "../../style";

/** What the restyle answers: the rewritten parts and the check over them, as `restyleSteps` and `restyleDraft` return it. */
export type StyleAnswer = { parts: RestyledPart[]; check: RestyleCheck };

/** Which version of the recipe the household is saving. */
export type Choice = "rewrite" | "original";

/**
 * The household's choice: the rewrite or the author's recipe, the whole of
 * it (decisions.md row 229), and the rewritten step texts retyped in place,
 * keyed by the rewrite's own part and step.
 */
export type StyleChoices = {
  recipe: Choice;
  edits: Readonly<Record<string, string>>;
};

/** Whether the rewrite laid the recipe out afresh: new parts, or rows moved between them. Pure. */
export function isRebuilt(original: readonly OriginalPart[], answer: StyleAnswer): boolean {
  return !keepsLayout(original, answer.parts);
}

/** Every ingredient row of the recipe in order: what a rewrite's row numbers count through. Pure. */
export function allRows(original: readonly OriginalPart[]): OriginalPart["ingredients"][number][] {
  return original.flatMap((part) => part.ingredients);
}

/** The recipe as one part: what a rebuilt rewrite's findings are placed against. Pure. */
export function wholeRecipe(original: readonly OriginalPart[]): OriginalPart {
  return { name: "", ingredients: allRows(original), steps: original.flatMap((part) => part.steps) };
}

/** The author's recipe in the answer's shape: each part its own rows, notes and steps. Pure. */
export function asWritten(original: readonly OriginalPart[]): RestyledPart[] {
  const inPlace = rowsInPlace(original);
  return original.map((part, p) => ({
    name: part.name,
    rows: inPlace[p]!,
    notes: part.ingredients.map((row) => row.note ?? ""),
    steps: part.steps.map(asRestyled),
  }));
}

/** One thing the check found, worded for the step or part it is shown on. */
export type Finding = { kind: "condition" | "added" | "fact" | "food" | "rows"; item: string; message: string };

/** The key of step `step` of part `part` in `StyleChoices`. */
export function stepKey(part: number, step: number): string {
  return `${part}.${step}`;
}

/**
 * A part as the check reads it, from a saved recipe or a draft: each row
 * carrying its line without the note, since the note is what the restyle may
 * rewrite and is read, and shown, on its own.
 */
export function styleOriginal(
  parts: readonly {
    name: string;
    ingredients: readonly Parameters<typeof formatIngredient>[0][];
    steps: readonly { title?: string; text: string; summary?: string }[];
  }[]
): OriginalPart[] {
  return parts.map((part) => ({
    name: part.name,
    ingredients: part.ingredients.map((row) => ({ ...row, line: formatIngredient({ ...row, note: "" }).trim() || row.originalText })),
    steps: part.steps.map((step) => ({ title: step.title ?? "", text: step.text, summary: step.summary ?? "" })),
  }));
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
    case "added":
      return `The rewrite adds “${item}”, which the recipe never says.`;
    case "fact":
      return `The original’s “${item}” is not in the rewrite.`;
    case "food":
      return `The rewrite no longer names ${item}.`;
    case "rows":
      return "The rewrite’s notes do not line up with this part’s ingredients.";
  }
}

/**
 * What the check found in the rewrite, worded for the house style's column:
 * over the whole recipe when the rewrite laid it out afresh, part by part
 * when it kept the layout. Pure.
 */
export function answerFindings(original: readonly OriginalPart[], answer: StyleAnswer): Finding[] {
  if (isRebuilt(original, answer)) return checkFindings(answer.check.parts[0]);
  return original.flatMap((_, p) => checkFindings(answer.check.parts[p]));
}

function checkFindings(check: PartRestyleCheck | undefined): Finding[] {
  if (check === undefined) return [];
  const found = (kind: Finding["kind"], items: readonly string[]) => items.map((item) => ({ kind, item, message: findingMessage(kind, item) }));
  return [
    ...found("condition", check.missingConditions),
    ...found("fact", check.missingFacts),
    ...found("food", check.missingFoods),
    ...found("added", check.addedConditions),
    ...(check.rowMismatch ? found("rows", [""]) : []),
  ];
}

/**
 * Where the choice starts: on the rewrite, always. What the check found is
 * shown with it, for the household to weigh; it never quietly puts the
 * author's recipe in the rewrite's place (decisions.md row 229).
 */
export function initialChoices(): StyleChoices {
  return { recipe: "rewrite", edits: {} };
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
 * The parts to save, in the answer's shape: the author's recipe as written,
 * or the rewrite with any retyped step. A rewrite that kept the layout keeps
 * each part's own name and rows, and a part the rewrite gave no steps keeps
 * the author's. What `applyRestyle` and `createRestyledRecipe` take.
 */
export function assemble(original: readonly OriginalPart[], answer: StyleAnswer, choices: StyleChoices): RestyledPart[] {
  if (choices.recipe === "original") return asWritten(original);
  const steps = (part: RestyledPart, p: number) => part.steps.map((step, s) => edited(step, choices, stepKey(p, s)));
  if (isRebuilt(original, answer)) return answer.parts.map((part, p) => ({ ...part, steps: steps(part, p) }));
  const inPlace = rowsInPlace(original);
  return original.map((part, p) => {
    const rewrite = answer.parts[p]!;
    const kept = rewrite.steps.length === 0 && part.steps.length > 0;
    return { name: part.name, rows: inPlace[p]!, notes: [...rewrite.notes], steps: kept ? part.steps.map(asRestyled) : steps(rewrite, p) };
  });
}

/** Whether the assembled parts say anything the author's do not: false when every choice is the original, so there is nothing to write. */
export function changesAnything(original: readonly OriginalPart[], assembled: readonly RestyledPart[]): boolean {
  if (!keepsLayout(original, assembled)) return true;
  return original.some((part, p) => {
    const next = assembled[p]!;
    if (next.steps.length !== part.steps.length) return true;
    if (next.steps.some((step, s) => !sameStep(part.steps[s]!, step))) return true;
    return next.notes.some((note, i) => note.trim() !== (part.ingredients[i]?.note ?? "").trim());
  });
}

/**
 * The same check the restyle ran, over what will actually be saved, so a
 * step retyped here is checked too.
 */
export function checkChoices(original: readonly OriginalPart[], assembled: readonly RestyledPart[]): RestyleCheck {
  return checkRestyle(original, assembled);
}

/** A part's heading: its name, or "Method" for the unnamed main body. */
export function partHeading(name: string): string {
  return name.trim() === "" ? "Method" : name.trim();
}

/** The assembled parts as the save calls take them: plain copies, since the answer's lists are read-only. */
export function forSaving(parts: readonly RestyledPart[]): { name: string; rows: number[]; notes: string[]; steps: RestyledStep[] }[] {
  return parts.map((part) => ({ name: part.name, rows: [...part.rows], notes: [...part.notes], steps: part.steps.map((step) => ({ ...step })) }));
}
