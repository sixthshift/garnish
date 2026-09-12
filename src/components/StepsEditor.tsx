// The step rows of one part: a textarea per step in a ReorderList, with add,
// remove and move up/down. The parent owns the draft; every change goes
// through a pure helper and comes back through `onChange` as a new
// `RecipeDraft`.
//
// `pi` names the part whose `steps` these are — the only place a step can
// live (decisions.md row 49). The document carries no position fields: the
// repository writes them from array order on save, so moving a row is the
// whole story.
//
// Row actions are in one `⋮` per step and list actions are in the section
// header, once (decisions.md row 54). Four buttons under every textarea is
// forty controls for a ten-step method, and on a phone they wrapped to three
// lines under each one; Mealie's step menu carries seven entries and Tandoor
// puts split-all and merge-all above the list, which is what this is.
import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Muted } from "@sixthshift/design-system/muted";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useState } from "react";
import { paragraphs } from "../domain/bulkText";
import { randomUuid } from "../lib/ids";
import type { DraftStep, FieldErrors, RecipeDraft } from "./RecipeForm";
import { BulkAddSheet } from "./ui/BulkAddSheet";
import { Menu } from "./ui/Menu";
import { moveItem, ReorderList } from "./ui/ReorderList";

// --- Pure helpers -----------------------------------------------------------

/** A blank step with a fresh id, so it has a stable row key before it is saved. */
export function newStep(text = ""): DraftStep {
  return { id: randomUuid(), text };
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
    steps.map((step, i) => (i === si ? { ...step, text } : step)),
  );
}

/** The draft without step `si` of part `pi`'s step array. Out-of-range indices return a copy unchanged. Pure. */
export function removeStep(draft: RecipeDraft, pi: number, si: number): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps || si < 0 || si >= steps.length) return withSteps(draft, pi, steps?.slice() ?? []);
  return withSteps(
    draft,
    pi,
    steps.filter((_, i) => i !== si),
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
 * paragraph in its own text (blank-line separated). A step whose text is one
 * paragraph, or none, comes back unchanged — the same rule the button uses to
 * disable itself. An out-of-range `si` returns a copy unchanged. Pure apart
 * from the new steps' ids.
 */
export function splitStepByParagraph(draft: RecipeDraft, pi: number, si: number): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps || si < 0 || si >= steps.length) return withSteps(draft, pi, steps?.slice() ?? []);
  const chunks = paragraphs(steps[si]!.text ?? "");
  if (chunks.length < 2) return withSteps(draft, pi, steps.slice());
  return withSteps(draft, pi, [...steps.slice(0, si), ...chunks.map((text) => newStep(text)), ...steps.slice(si + 1)]);
}

/**
 * The draft with step `si` of part `pi`'s step array merged with the step after
 * it: their text joined by a blank line, kept at `si`'s id; the next step is
 * dropped. The last step has nothing to merge with and comes back unchanged,
 * the same rule the button uses to disable itself. An out-of-range `si`
 * returns a copy unchanged. Pure.
 */
export function mergeStepWithNext(draft: RecipeDraft, pi: number, si: number): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps || si < 0 || si + 1 >= steps.length) return withSteps(draft, pi, steps?.slice() ?? []);
  const merged: DraftStep = { ...steps[si]!, text: [steps[si]!.text ?? "", steps[si + 1]!.text ?? ""].filter((text) => text.trim() !== "").join("\n\n") };
  return withSteps(draft, pi, [...steps.slice(0, si), merged, ...steps.slice(si + 2)]);
}

/**
 * The draft with every step of part `pi` replaced by one step per paragraph in
 * its own text — Tandoor's "Split" over the whole list rather than one row at
 * a time. A list where no step has two paragraphs comes back unchanged, the
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
    }),
  );
}

/**
 * The draft with every step of part `pi` merged into one, their text joined by
 * blank lines and the first step's id kept — Tandoor's "Merge" over the whole
 * list. Fewer than two steps comes back unchanged. Pure.
 */
export function mergeAllSteps(draft: RecipeDraft, pi: number): RecipeDraft {
  const steps = stepsOf(draft, pi);
  if (!steps || steps.length < 2) return withSteps(draft, pi, steps?.slice() ?? []);
  const text = steps
    .map((step) => (step.text ?? "").trim())
    .filter((part) => part !== "")
    .join("\n\n");
  return withSteps(draft, pi, [{ ...steps[0]!, text }]);
}

/** Would "Split all" change anything: does any step hold more than one paragraph? Pure. */
export function canSplitAll(steps: readonly DraftStep[]): boolean {
  return steps.some((step) => paragraphs(step.text ?? "").length > 1);
}

/** The field-name prefix for step rows: "parts.0.steps". Pure. */
export function stepsPath(pi: number): string {
  return `parts.${pi}.steps`;
}

// --- Component --------------------------------------------------------------

export type StepsEditorProps = {
  draft: RecipeDraft;
  /** Index of the part whose steps these are. */
  pi: number;
  onChange: (draft: RecipeDraft) => void;
  /** The list's heading. Default "Steps". */
  heading?: string;
  errors?: FieldErrors;
  disabled?: boolean;
};

export function StepsEditor({ draft, pi, onChange, heading = "Steps", errors = {}, disabled }: StepsEditorProps) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const steps = stepsOf(draft, pi);
  if (!steps) return null;
  const path = stepsPath(pi);
  const last = steps.length - 1;

  return (
    <div className="flex flex-col gap-2" data-steps={pi}>
      <div className="flex items-center justify-between gap-3">
        <Muted as="span" className="text-xs font-medium uppercase tracking-wide">
          {heading}
        </Muted>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            intent="neutral"
            size="sm"
            disabled={disabled || !canSplitAll(steps)}
            onClick={() => onChange(splitAllSteps(draft, pi))}
          >
            Split all
          </Button>
          <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled || steps.length < 2} onClick={() => onChange(mergeAllSteps(draft, pi))}>
            Merge all
          </Button>
          <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled} onClick={() => setBulkOpen(true)}>
            Bulk add
          </Button>
          <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled} onClick={() => onChange(addStep(draft, pi))}>
            Add step
          </Button>
        </div>
      </div>
      <BulkAddSheet
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        itemName="step"
        disabled={disabled}
        onAdd={(lines) => onChange(addBulkSteps(draft, pi, lines))}
      />
      <EmptyBoundary
        isEmpty={steps.length === 0}
        fallback={
          <Muted as="p" className="text-sm">
            No steps yet
          </Muted>
        }
      >
        <ReorderList
          items={steps}
          keyOf={(step) => step.id ?? "unsaved"}
          itemName="step"
          onReorder={(next) => onChange(withSteps(draft, pi, next))}
          renderItem={(step, si) => {
            const error = errors[`${path}.${si}.text`];
            return (
              <div className="flex gap-2" data-step={si}>
                <span className="mt-2 w-5 shrink-0 text-right text-sm font-medium text-fg-subtle" aria-hidden="true">
                  {si + 1}.
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Textarea
                    name={`${path}.${si}.text`}
                    aria-label={`Step ${si + 1}`}
                    aria-invalid={error !== undefined || undefined}
                    rows={2}
                    placeholder="What to do"
                    value={step.text ?? ""}
                    disabled={disabled}
                    onChange={(event) => onChange(updateStep(draft, pi, si, event.target.value))}
                  />
                  {error !== undefined && (
                    <p className="text-sm text-fg-danger" role="alert">
                      {error}
                    </p>
                  )}
                </div>
                <Menu label={`Step ${si + 1} actions`} iconOnly>
                  <Menu.Item onSelect={() => onChange(insertStepAbove(draft, pi, si))}>Insert above</Menu.Item>
                  <Menu.Item onSelect={() => onChange(insertStepBelow(draft, pi, si))}>Insert below</Menu.Item>
                  <Menu.Item disabled={paragraphs(step.text ?? "").length < 2} onSelect={() => onChange(splitStepByParagraph(draft, pi, si))}>
                    Split by paragraph
                  </Menu.Item>
                  <Menu.Item disabled={si === last} onSelect={() => onChange(mergeStepWithNext(draft, pi, si))}>
                    Merge with next
                  </Menu.Item>
                  <Menu.Item intent="danger" onSelect={() => onChange(removeStep(draft, pi, si))}>
                    Delete
                  </Menu.Item>
                </Menu>
              </div>
            );
          }}
        />
      </EmptyBoundary>
    </div>
  );
}
