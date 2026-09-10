// The step rows of one component, or the recipe's own steps: a textarea per
// step in a ReorderList, with add, remove and move up/down. The parent owns
// the draft; every change goes through a pure helper and comes back through
// `onChange` as a new `RecipeDraft`.
//
// One editor serves both places a step can live. `ci` names the component
// whose `steps` these are; `ci === null` means the recipe-level `steps` array,
// the ones the view page prints after every component ("To finish" when
// there is more than one). The document carries no position fields: the
// repository writes them from array order on save, so moving a row is the
// whole story.
import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { Textarea } from "@sixthshift/design-system/textarea";
import { randomUuid } from "../lib/ids";
import type { DraftStep, FieldErrors, RecipeDraft } from "./RecipeForm";
import { moveItem, ReorderList } from "./ui/ReorderList";

// --- Pure helpers -----------------------------------------------------------

/** A blank step with a fresh id, so it has a stable row key before it is saved. */
export function newStep(text = ""): DraftStep {
  return { id: randomUuid(), text };
}

/** The step array `ci` names: a component's steps, or the recipe's own for null. Undefined for an out-of-range `ci`. Pure. */
export function stepsOf(draft: RecipeDraft, ci: number | null): DraftStep[] | undefined {
  return ci === null ? draft.steps : draft.components[ci]?.steps;
}

/** The draft with the step array `ci` names replaced by `steps`. An out-of-range `ci` returns a copy unchanged. Pure. */
export function withSteps(draft: RecipeDraft, ci: number | null, steps: DraftStep[]): RecipeDraft {
  if (ci === null) return { ...draft, steps };
  if (ci < 0 || !draft.components[ci]) return { ...draft, components: draft.components.slice() };
  return { ...draft, components: draft.components.map((component, i) => (i === ci ? { ...component, steps } : component)) };
}

/** The draft with a blank step appended to the array `ci` names. Pure apart from the step's id. */
export function addStep(draft: RecipeDraft, ci: number | null, text = ""): RecipeDraft {
  const steps = stepsOf(draft, ci);
  if (!steps) return withSteps(draft, ci, []);
  return withSteps(draft, ci, [...steps, newStep(text)]);
}

/** The draft with step `si` of the array `ci` names given `text`. Out-of-range indices return a copy unchanged. Pure. */
export function updateStep(draft: RecipeDraft, ci: number | null, si: number, text: string): RecipeDraft {
  const steps = stepsOf(draft, ci);
  if (!steps || si < 0 || si >= steps.length) return withSteps(draft, ci, steps?.slice() ?? []);
  return withSteps(
    draft,
    ci,
    steps.map((step, i) => (i === si ? { ...step, text } : step)),
  );
}

/** The draft without step `si` of the array `ci` names. Out-of-range indices return a copy unchanged. Pure. */
export function removeStep(draft: RecipeDraft, ci: number | null, si: number): RecipeDraft {
  const steps = stepsOf(draft, ci);
  if (!steps || si < 0 || si >= steps.length) return withSteps(draft, ci, steps?.slice() ?? []);
  return withSteps(
    draft,
    ci,
    steps.filter((_, i) => i !== si),
  );
}

/** The draft with step `from` of the array `ci` names moved to `to`. Same rules as `moveItem`. Pure. */
export function moveStep(draft: RecipeDraft, ci: number | null, from: number, to: number): RecipeDraft {
  const steps = stepsOf(draft, ci);
  if (!steps) return withSteps(draft, ci, []);
  return withSteps(draft, ci, moveItem(steps, from, to));
}

/** The field-name prefix for step rows: "components.0.steps" or "steps". Pure. */
export function stepsPath(ci: number | null): string {
  return ci === null ? "steps" : `components.${ci}.steps`;
}

// --- Component --------------------------------------------------------------

export type StepsEditorProps = {
  draft: RecipeDraft;
  /** Index of the component whose steps these are, or null for the recipe's own steps. */
  ci: number | null;
  onChange: (draft: RecipeDraft) => void;
  /** The list's heading. Default "Steps". */
  heading?: string;
  errors?: FieldErrors;
  disabled?: boolean;
};

export function StepsEditor({ draft, ci, onChange, heading = "Steps", errors = {}, disabled }: StepsEditorProps) {
  const steps = stepsOf(draft, ci);
  if (!steps) return null;
  const path = stepsPath(ci);

  return (
    <div className="flex flex-col gap-2" data-steps={ci ?? "recipe"}>
      <div className="flex items-center justify-between gap-3">
        <Muted as="span" className="text-xs font-medium uppercase tracking-wide">
          {heading}
        </Muted>
        <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled} onClick={() => onChange(addStep(draft, ci))}>
          Add step
        </Button>
      </div>
      {steps.length === 0 ? (
        <Muted as="p" className="text-sm">
          No steps yet
        </Muted>
      ) : (
        <ReorderList
          items={steps}
          keyOf={(step) => step.id ?? "unsaved"}
          itemName="step"
          onReorder={(next) => onChange(withSteps(draft, ci, next))}
          onRemove={(_, si) => onChange(removeStep(draft, ci, si))}
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
                    onChange={(event) => onChange(updateStep(draft, ci, si, event.target.value))}
                  />
                  {error !== undefined && (
                    <p className="text-sm text-fg-danger" role="alert">
                      {error}
                    </p>
                  )}
                </div>
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
