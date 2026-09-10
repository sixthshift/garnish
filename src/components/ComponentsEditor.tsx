// The recipe editor's component list: add, rename, reorder and delete the
// named sections a recipe is made of. Each row edits its ingredients through
// `IngredientsEditor` and its steps through `StepsEditor`.
// The parent owns the draft: every change goes through one of the pure
// helpers below and comes back through `onChange` as a new `RecipeDraft`.
//
// Positions are never edited here. The document carries no position fields;
// the repository writes them from array order on save, so moving a row is
// the whole story.
//
// A component with nothing in it is removed on the spot. One that holds
// ingredients or steps asks first, in a modal, because the rows go with it
// and there is no undo. A recipe always keeps at least one component (the
// schema requires it), so the sole component has no remove button.
import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { useState } from "react";
import { formatIngredient } from "../domain/format";
import { ingredientInputSchema, type Unit } from "../domain/recipe";
import { randomUuid } from "../lib/ids";
import { IngredientsEditor } from "./IngredientsEditor";
import type { DraftComponent, DraftIngredient, FieldErrors, RecipeDraft } from "./RecipeForm";
import { StepsEditor } from "./StepsEditor";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { moveItem, ReorderList } from "./ui/ReorderList";

/** A blank component with a fresh id, so it has a stable row key before it is saved. */
export function newComponent(name = ""): DraftComponent {
  return { id: randomUuid(), name, ingredients: [], steps: [] };
}

/** The draft with a blank component appended. Pure apart from the new component's random id. */
export function addComponent(draft: RecipeDraft, name = ""): RecipeDraft {
  return { ...draft, components: [...draft.components, newComponent(name)] };
}

/** The draft with component `index` renamed. An out-of-range index returns a copy unchanged. Pure. */
export function renameComponent(draft: RecipeDraft, index: number, name: string): RecipeDraft {
  return {
    ...draft,
    components: draft.components.map((component, i) => (i === index ? { ...component, name } : component)),
  };
}

/**
 * The draft without component `index`. Refuses to remove the last component
 * (a recipe needs at least one) and ignores an out-of-range index; both
 * return a copy unchanged. Pure.
 */
export function removeComponent(draft: RecipeDraft, index: number): RecipeDraft {
  if (draft.components.length <= 1 || index < 0 || index >= draft.components.length) {
    return { ...draft, components: draft.components.slice() };
  }
  return { ...draft, components: draft.components.filter((_, i) => i !== index) };
}

/** The draft with component `from` moved to `to`. Same rules as `moveItem`. Pure. */
export function moveComponent(draft: RecipeDraft, from: number, to: number): RecipeDraft {
  return { ...draft, components: moveItem(draft.components, from, to) };
}

/** Whether removing the component would take ingredients or steps with it. Pure. */
export function hasContent(component: DraftComponent): boolean {
  return component.ingredients.length > 0 || component.steps.length > 0;
}

/** "Pastry", or "component 2" for an unnamed one, for buttons and the confirm title. Pure. */
export function componentLabel(component: DraftComponent, index: number): string {
  const name = (component.name ?? "").trim();
  return name === "" ? `component ${index + 1}` : name;
}

/**
 * One ingredient line for a draft row. Draft ingredients are the input shape
 * (fields optional), so the schema fills defaults first; a row the schema
 * rejects (a negative quantity mid-edit) falls back to its raw text. Pure.
 */
export function ingredientLine(ingredient: DraftIngredient): string {
  const parsed = ingredientInputSchema.safeParse(ingredient);
  if (parsed.success) return formatIngredient(parsed.data);
  return (ingredient.originalText ?? "").trim() || (ingredient.note ?? "").trim();
}

/** "3 ingredients and 1 step", "1 ingredient", "2 steps". Pure. */
export function contentSummary(component: DraftComponent): string {
  const parts: string[] = [];
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  if (component.ingredients.length > 0) parts.push(count(component.ingredients.length, "ingredient"));
  if (component.steps.length > 0) parts.push(count(component.steps.length, "step"));
  return parts.join(" and ");
}

export type ComponentsEditorProps = {
  draft: RecipeDraft;
  onChange: (draft: RecipeDraft) => void;
  /** Units the ingredient rows suggest. */
  units?: readonly Unit[];
  errors?: FieldErrors;
  disabled?: boolean;
};

export function ComponentsEditor({ draft, onChange, units = [], errors = {}, disabled }: ComponentsEditorProps) {
  // Index of the component whose removal is awaiting confirmation.
  const [confirming, setConfirming] = useState<number | null>(null);
  const { components } = draft;
  const pending = confirming === null ? undefined : components[confirming];

  const remove = (index: number) => {
    setConfirming(null);
    onChange(removeComponent(draft, index));
  };

  return (
    <section className="flex flex-col gap-3" aria-label="Components">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle as="h2">Components</SectionTitle>
        <Button type="button" variant="outline" intent="neutral" size="sm" disabled={disabled} onClick={() => onChange(addComponent(draft))}>
          Add component
        </Button>
      </div>

      {/* A draft normally keeps at least one component (the schema requires it); the fallback covers a draft that lost it. */}
      <EmptyBoundary
        isEmpty={components.length === 0}
        fallback={
          <Muted as="p" className="text-sm">
            No components yet
          </Muted>
        }
      >
        <ReorderList
          items={components}
          keyOf={(component) => component.id ?? "unsaved"}
          itemName="component"
          onReorder={(next) => onChange({ ...draft, components: next })}
          onRemove={
            components.length > 1
              ? (component, index) => {
                  if (hasContent(component)) setConfirming(index);
                  else remove(index);
                }
              : undefined
          }
          renderItem={(component, index) => (
            <div className="flex flex-col gap-3 rounded-xl border border-border-normal p-3" data-component={index}>
              <Input
                name={`components.${index}.name`}
                value={component.name ?? ""}
                placeholder="Component name"
                aria-label={`Component ${index + 1} name`}
                aria-invalid={errors[`components.${index}.name`] !== undefined || undefined}
                autoComplete="off"
                disabled={disabled}
                onChange={(event) => onChange(renameComponent(draft, index, event.target.value))}
              />
              {errors[`components.${index}.name`] !== undefined && (
                <p className="text-sm text-fg-danger" role="alert">
                  {errors[`components.${index}.name`]}
                </p>
              )}
              <IngredientsEditor draft={draft} ci={index} units={units} onChange={onChange} errors={errors} disabled={disabled} />
              <StepsEditor draft={draft} ci={index} onChange={onChange} errors={errors} disabled={disabled} />
            </div>
          )}
        />
      </EmptyBoundary>

      {pending !== undefined && confirming !== null && (
        <ConfirmDialog
          title={`Remove ${componentLabel(pending, confirming)}?`}
          confirmLabel="Remove"
          aria-label="Remove component"
          onCancel={() => setConfirming(null)}
          onConfirm={() => remove(confirming)}
        >
          It has {contentSummary(pending)}, which go with it. This cannot be undone.
        </ConfirmDialog>
      )}
    </section>
  );
}
