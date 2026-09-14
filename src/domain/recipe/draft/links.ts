// The links between a part's steps and its ingredient rows.
import { suggestLinks } from "../stepIngredients";
import { type DraftIngredient, type DraftPart, type DraftStep, type RecipeDraft } from "./types";
import { stepsOf, withSteps } from "./steps";

/** A step's ingredient links. `DraftStep` comes from the write shape, where the field is optional, so undefined reads as none. Pure. */
export function stepLinks(step: DraftStep): string[] {
  return step.ingredientIds ?? [];
}

/** Every link of `steps`, in step order then link order, each id once. What a merge keeps. Pure. */
export function unionLinks(steps: readonly DraftStep[]): string[] {
  return [...new Set(steps.flatMap(stepLinks))];
}

/** The part's ingredient rows `step` links, in link order; a link naming no row of the part is skipped. Pure. */
export function linkedIngredients(part: DraftPart, step: DraftStep): DraftIngredient[] {
  return stepLinks(step)
    .map((linked) => part.ingredients.find((row) => row.id === linked))
    .filter((row): row is DraftIngredient => row !== undefined);
}

/** The part's ingredient rows `step` does not link, in list order — what the picker offers. Rows without an id yet cannot be linked and are left out. Pure. */
export function linkableIngredients(part: DraftPart, step: DraftStep): DraftIngredient[] {
  const linked = new Set(stepLinks(step));
  return part.ingredients.filter((row) => row.id !== undefined && !linked.has(row.id));
}

/** The draft with `ingredientId` appended to step `si` of part `pi`'s links. An id already linked, or an out-of-range index, returns a copy unchanged. Pure. */
export function linkIngredient(draft: RecipeDraft, pi: number, si: number, ingredientId: string): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps || si < 0 || si >= steps.length || stepLinks(steps[si]!).includes(ingredientId)) return withSteps(draft, pi, steps?.slice() ?? []);
  return withSteps(
    draft,
    pi,
    steps.map((step, i) => (i === si ? { ...step, ingredientIds: [...stepLinks(step), ingredientId] } : step)),
  );
}

/** The draft without `ingredientId` in step `si` of part `pi`'s links. What a chip's remove button does. Pure. */
export function unlinkStepIngredient(draft: RecipeDraft, pi: number, si: number, ingredientId: string): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps || si < 0 || si >= steps.length) return withSteps(draft, pi, steps?.slice() ?? []);
  return withSteps(
    draft,
    pi,
    steps.map((step, i) => (i === si ? { ...step, ingredientIds: stepLinks(step).filter((linked) => linked !== ingredientId) } : step)),
  );
}

/**
 * `part` with `ingredientId` gone from every step's links. What a deleted row,
 * or a row moved to another part, leaves behind: a link never crosses a part,
 * so the part it left must forget it. A part that never linked it comes back
 * as-is. Pure.
 */
export function unlinkIngredient<P extends { steps: DraftStep[] }>(part: P, ingredientId: string): P {
  if (!part.steps.some((step) => stepLinks(step).includes(ingredientId))) return part;
  return {
    ...part,
    steps: part.steps.map((step) => (stepLinks(step).includes(ingredientId) ? { ...step, ingredientIds: stepLinks(step).filter((linked) => linked !== ingredientId) } : step)),
  };
}

/**
 * The draft with the M28.2 matcher run over part `pi`: every step with no
 * links gets the part's ingredients named in its text, and a step that already
 * links something is left alone. `filled` counts the steps that gained links,
 * which is what the button reports. Pure.
 */
export function suggestPartLinks(draft: RecipeDraft, pi: number): { draft: RecipeDraft; filled: number } {
  const part = draft.parts[pi];
  if (!part) return { draft: { ...draft, parts: draft.parts.slice() }, filled: 0 };
  // The matcher wants a saved shape: an id per row and a text and a link array
  // per step. A draft row without an id has never been saved and cannot be
  // named by a link, so it is not a candidate.
  const ingredients = part.ingredients.flatMap((row) => (row.id === undefined ? [] : [{ id: row.id, food: row.food ?? null }]));
  const steps = part.steps.map((step) => ({ id: step.id ?? "", text: step.text ?? "", ingredientIds: stepLinks(step) }));
  const next = suggestLinks({ ingredients, steps });
  const filled = next.filter((step, i) => step.ingredientIds.length > stepLinks(part.steps[i]!).length).length;
  const merged = part.steps.map((step, i) => (next[i]!.ingredientIds.length > stepLinks(step).length ? { ...step, ingredientIds: next[i]!.ingredientIds } : step));
  return { draft: withSteps(draft, pi, merged), filled };
}

