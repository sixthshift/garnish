// The step rows of one part: a textarea per step in a ReorderList, with add,
// remove and move up/down. The parent owns the draft; every change goes
// through a pure helper and comes back through `onChange` as a new
// `RecipeDraft`.
//
// `pi` names the part whose `steps` these are — the only place a step can
// live (decisions.md row 49). The document carries no position fields: the
// repository writes them from array order on save, so moving a row is the
// whole story.
import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Muted } from "@sixthshift/design-system/muted";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useState } from "react";
import { paragraphs } from "../domain/bulkText";
import { randomUuid } from "../lib/ids";
import type { DraftStep, FieldErrors, RecipeDraft } from "./RecipeForm";
import { BulkAddSheet } from "./ui/BulkAddSheet";
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
          onRemove={(_, si) => onChange(removeStep(draft, pi, si))}
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
                  <div className="flex flex-wrap gap-1" role="group" aria-label={`Step ${si + 1} tools`}>
                    <Button
                      type="button"
                      variant="ghost"
                      intent="neutral"
                      size="sm"
                      aria-label={`Insert step above step ${si + 1}`}
                      disabled={disabled}
                      onClick={() => onChange(insertStepAbove(draft, pi, si))}
                    >
                      Insert above
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      intent="neutral"
                      size="sm"
                      aria-label={`Insert step below step ${si + 1}`}
                      disabled={disabled}
                      onClick={() => onChange(insertStepBelow(draft, pi, si))}
                    >
                      Insert below
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      intent="neutral"
                      size="sm"
                      aria-label={`Split step ${si + 1} by paragraph`}
                      disabled={disabled || paragraphs(step.text ?? "").length < 2}
                      onClick={() => onChange(splitStepByParagraph(draft, pi, si))}
                    >
                      Split by paragraph
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      intent="neutral"
                      size="sm"
                      aria-label={`Merge step ${si + 1} with next`}
                      disabled={disabled || si === last}
                      onClick={() => onChange(mergeStepWithNext(draft, pi, si))}
                    >
                      Merge with next
                    </Button>
                  </div>
                </div>
              </div>
            );
          }}
        />
      </EmptyBoundary>
    </div>
  );
}
