import { randomUuid } from "../../lib/id";
import { moveItem } from "../../lib/lists";
import { paragraphs } from "../ingredient";
import type { Recipe } from "../recipe";
import { draftFromRecipe } from "./draft";
import { stepLinks, unionLinks } from "./links";
import type { DraftStep, RecipeDraft } from "./types";

/** A blank step with a fresh id, so it has a stable row key before it is saved. */
export function newStep(text = ""): DraftStep {
  return { id: randomUuid(), text, ingredientIds: [] };
}

/** Part `pi`'s step array. Undefined for an out-of-range `pi`. Pure. */
export function stepsOf(draft: RecipeDraft, pi: number): DraftStep[] | undefined {
  return draft.parts[pi]?.steps;
}

/** The draft with part `pi`'s steps replaced by `steps`. An out-of-range `pi` returns a copy unchanged. Pure. */
export function withSteps(draft: RecipeDraft, pi: number, steps: DraftStep[]): RecipeDraft {
  if (pi < 0 || !draft.parts[pi]) return { ...draft, parts: draft.parts.slice() };
  return { ...draft, parts: draft.parts.map((part, i) => (i === pi ? { ...part, steps } : part)) };
}

/** The draft with a blank step appended to part `pi`'s step array. Pure apart from the step's id. */
export function addStep(draft: RecipeDraft, pi: number, text = ""): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps) return withSteps(draft, pi, []);
  return withSteps(draft, pi, [...steps, newStep(text)]);
}

/** The draft with step `si` of part `pi`'s step array given `text`. Out-of-range indices return a copy unchanged. Pure. */
export function updateStep(draft: RecipeDraft, pi: number, si: number, text: string): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps || si < 0 || si >= steps.length) return withSteps(draft, pi, steps?.slice() ?? []);
  return withSteps(
    draft,
    pi,
    steps.map((step, i) => (i === si ? { ...step, text } : step))
  );
}

/**
 * The draft with step `si` of part `pi`'s step array pointing at `image` — the
 * file name the upload route answered with, or null to drop the photo from the
 * document. The bytes are already on disk either way; this is what the
 * next save writes back to `step.image`. Out-of-range indices return a copy
 * unchanged. Pure.
 */
export function setStepImage(draft: RecipeDraft, pi: number, si: number, image: string | null): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps || si < 0 || si >= steps.length) return withSteps(draft, pi, steps?.slice() ?? []);
  return withSteps(
    draft,
    pi,
    steps.map((step, i) => (i === si ? { ...step, image } : step))
  );
}

/** The draft without step `si` of part `pi`'s step array. Out-of-range indices return a copy unchanged. Pure. */
export function removeStep(draft: RecipeDraft, pi: number, si: number): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps || si < 0 || si >= steps.length) return withSteps(draft, pi, steps?.slice() ?? []);
  return withSteps(
    draft,
    pi,
    steps.filter((_, i) => i !== si)
  );
}

/** The draft with step `from` of part `pi`'s step array moved to `to`. Same rules as `moveItem`. Pure. */
export function moveStep(draft: RecipeDraft, pi: number, from: number, to: number): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps) return withSteps(draft, pi, []);
  return withSteps(draft, pi, moveItem(steps, from, to));
}

/** The draft with one step appended per line in `lines`, in order, to part `pi`'s step array. What the bulk-add sheet's "Add" commits. No lines returns a copy unchanged. Pure apart from the new steps' ids. */
export function addBulkSteps(draft: RecipeDraft, pi: number, lines: readonly string[]): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps || lines.length === 0) return withSteps(draft, pi, steps?.slice() ?? []);
  return withSteps(draft, pi, [...steps, ...lines.map((text) => newStep(text))]);
}

/** The draft with a blank step inserted before step `si` of part `pi`'s step array. An out-of-range `si` returns a copy unchanged. Pure apart from the new step's id. */
export function insertStepAbove(draft: RecipeDraft, pi: number, si: number): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps || si < 0 || si >= steps.length) return withSteps(draft, pi, steps?.slice() ?? []);
  return withSteps(draft, pi, [...steps.slice(0, si), newStep(), ...steps.slice(si)]);
}

/** The draft with a blank step inserted after step `si` of part `pi`'s step array. An out-of-range `si` returns a copy unchanged. Pure apart from the new step's id. */
export function insertStepBelow(draft: RecipeDraft, pi: number, si: number): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps || si < 0 || si >= steps.length) return withSteps(draft, pi, steps?.slice() ?? []);
  return withSteps(draft, pi, [...steps.slice(0, si + 1), newStep(), ...steps.slice(si + 1)]);
}

/**
 * The draft with step `si` of part `pi`'s step array replaced by one step per
 * paragraph in its own text (blank-line separated). The first chunk keeps the
 * step's ingredient links and the rest start with none: the split cannot know
 * which half uses what, and the first chunk is the one that reads as the
 * original step. A step whose text is one paragraph, or none, comes back
 * unchanged — the same rule the button uses to
 * disable itself. An out-of-range `si` returns a copy unchanged. Pure apart
 * from the new steps' ids.
 */
export function splitStepByParagraph(draft: RecipeDraft, pi: number, si: number): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps || si < 0 || si >= steps.length) return withSteps(draft, pi, steps?.slice() ?? []);
  const chunks = paragraphs(steps[si]!.text ?? "");
  if (chunks.length < 2) return withSteps(draft, pi, steps.slice());
  const links = stepLinks(steps[si]!);
  return withSteps(draft, pi, [
    ...steps.slice(0, si),
    ...chunks.map((text, i) => (i === 0 ? { ...newStep(text), ingredientIds: links } : newStep(text))),
    ...steps.slice(si + 1),
  ]);
}

/**
 * The draft with step `si` of part `pi`'s step array merged with the step after
 * it: their text joined by a blank line, kept at `si`'s id, and their
 * ingredient links unioned in order; the next step is dropped. The last step has nothing to merge with and comes back unchanged,
 * the same rule the button uses to disable itself. An out-of-range `si`
 * returns a copy unchanged. Pure.
 */
export function mergeStepWithNext(draft: RecipeDraft, pi: number, si: number): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps || si < 0 || si + 1 >= steps.length) return withSteps(draft, pi, steps?.slice() ?? []);
  const merged: DraftStep = {
    ...steps[si]!,
    text: [steps[si]!.text ?? "", steps[si + 1]!.text ?? ""].filter((text) => text.trim() !== "").join("\n\n"),
    ingredientIds: unionLinks([steps[si]!, steps[si + 1]!]),
  };
  return withSteps(draft, pi, [...steps.slice(0, si), merged, ...steps.slice(si + 2)]);
}

/**
 * The draft with every step of part `pi` replaced by one step per paragraph in
 * its own text — Tandoor's "Split" over the whole list rather than one row at
 * a time. The first chunk of each split keeps that step's ingredient links, as
 * in `splitStepByParagraph`. A list where no step has two paragraphs comes back unchanged, the
 * same rule the button uses to disable itself. Pure apart from the new steps'
 * ids.
 */
export function splitAllSteps(draft: RecipeDraft, pi: number): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps || !canSplitAll(steps)) return withSteps(draft, pi, steps?.slice() ?? []);
  return withSteps(
    draft,
    pi,
    steps.flatMap((step) => {
      const chunks = paragraphs(step.text ?? "");
      return chunks.length < 2 ? [step] : chunks.map((text, i) => (i === 0 ? { ...step, text } : newStep(text)));
    })
  );
}

/**
 * The draft with every step of part `pi` merged into one, their text joined by
 * blank lines, their ingredient links unioned in order, and the first step's id kept — Tandoor's "Merge" over the whole
 * list. Fewer than two steps comes back unchanged. Pure.
 */
export function mergeAllSteps(draft: RecipeDraft, pi: number): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps || steps.length < 2) return withSteps(draft, pi, steps?.slice() ?? []);
  const text = steps
    .map((step) => (step.text ?? "").trim())
    .filter((part) => part !== "")
    .join("\n\n");
  return withSteps(draft, pi, [{ ...steps[0]!, text, ingredientIds: unionLinks(steps) }]);
}

/** Would "Split all" change anything: does any step hold more than one paragraph? Pure. */
export function canSplitAll(steps: readonly DraftStep[]): boolean {
  return steps.some((step) => paragraphs(step.text ?? "").length > 1);
}

/** The field-name prefix for step rows: "parts.0.steps". Pure. */
export function stepsPath(pi: number): string {
  return `parts.${pi}.steps`;
}

/**
 * The stored recipe as a draft with one step's text replaced: part `partId`'s
 * `stepId` keeps its id and its place and gets `patch`. The patch is the three
 * prose fields a step has, so a quick edit can move a sentence between the
 * label, the text and the supporting line in one save. An unknown part or step
 * returns the document unchanged. Pure.
 */
export function withStepReplaced(recipe: Recipe, partId: string, stepId: string, patch: { title: string; text: string; summary: string }): RecipeDraft {
  const draft = draftFromRecipe(recipe);
  return {
    ...draft,
    parts: draft.parts.map((part) =>
      part.id !== partId ? part : { ...part, steps: part.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)) }
    ),
  };
}
