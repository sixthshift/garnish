// The recipe editor's part list: add, rename, reorder and delete the named
// parts a recipe is made of. Each row edits its ingredients through
// `IngredientsEditor` and its steps through `StepsEditor`.
//
// A flat recipe — one part, unnamed — gets none of that chrome (decisions.md
// row 53). It is the common case, the view page has printed it without a
// heading since row 49, and a blank "Part name" input above the only
// ingredient list made every simple recipe look like a structured one that
// had forgotten its label. `isBare` is the test; "Add part" is the way out of
// it, and pressing it gives this part its name field back along with the new
// one.
//
// The parent owns the draft: every change goes through one of the pure
// helpers below and comes back through `onChange` as a new `RecipeDraft`.
//
// Positions are never edited here. The document carries no position fields;
// the repository writes them from array order on save, so moving a row is
// the whole story.
//
// A part with nothing in it is removed on the spot. One that holds
// ingredients or steps asks first, in a modal, because the rows go with it
// and there is no undo. A recipe always keeps at least one part (the schema
// requires it), so the sole part has no remove button.
import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { useState } from "react";
import { formatIngredient } from "../../../domain/ingredient/format";
import { ingredientInputSchema, type Unit } from "../../../domain/recipe/recipe";
import { randomUuid } from "../../../lib/ids";
import { IngredientsEditor } from "./IngredientsEditor";
import type { DraftIngredient, DraftPart, FieldErrors, RecipeDraft } from "./RecipeForm";
import { StepsEditor } from "./StepsEditor";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { moveItem, ReorderList } from "../../ui/ReorderList";

/** A blank part with a fresh id, so it has a stable row key before it is saved. */
export function newPart(name = ""): DraftPart {
  return { id: randomUuid(), name, ingredients: [], steps: [] };
}

/** The draft with a blank part appended. Pure apart from the new part's random id. */
export function addPart(draft: RecipeDraft, name = ""): RecipeDraft {
  return { ...draft, parts: [...draft.parts, newPart(name)] };
}

/** The draft with part `index` renamed. An out-of-range index returns a copy unchanged. Pure. */
export function renamePart(draft: RecipeDraft, index: number, name: string): RecipeDraft {
  return {
    ...draft,
    parts: draft.parts.map((part, i) => (i === index ? { ...part, name } : part)),
  };
}

/**
 * The draft without part `index`. Refuses to remove the last part (a recipe
 * needs at least one) and ignores an out-of-range index; both return a copy
 * unchanged. Pure.
 */
export function removePart(draft: RecipeDraft, index: number): RecipeDraft {
  if (draft.parts.length <= 1 || index < 0 || index >= draft.parts.length) {
    return { ...draft, parts: draft.parts.slice() };
  }
  return { ...draft, parts: draft.parts.filter((_, i) => i !== index) };
}

/** The draft with part `from` moved to `to`. Same rules as `moveItem`. Pure. */
export function movePart(draft: RecipeDraft, from: number, to: number): RecipeDraft {
  return { ...draft, parts: moveItem(draft.parts, from, to) };
}

/** Whether removing the part would take ingredients or steps with it. Pure. */
export function hasContent(part: DraftPart): boolean {
  return part.ingredients.length > 0 || part.steps.length > 0;
}

/** "Pastry", or "part 2" for an unnamed one, for buttons and the confirm title. Pure. */
export function partLabel(part: DraftPart, index: number): string {
  const name = (part.name ?? "").trim();
  return name === "" ? `part ${index + 1}` : name;
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

/**
 * Is this draft a flat recipe — one part, unnamed? Then the part is not a part
 * anyone chose, it is just the recipe (decisions.md rows 49 and 53), and the
 * editor prints its two lists without a name field, a card or a reorder
 * handle, exactly as the view page prints it without a heading. Pure.
 */
export function isBare(draft: RecipeDraft): boolean {
  return draft.parts.length === 1 && (draft.parts[0]!.name ?? "").trim() === "";
}

/** "3 ingredients and 1 step", "1 ingredient", "2 steps". Pure. */
export function contentSummary(part: DraftPart): string {
  const phrases: string[] = [];
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  if (part.ingredients.length > 0) phrases.push(count(part.ingredients.length, "ingredient"));
  if (part.steps.length > 0) phrases.push(count(part.steps.length, "step"));
  return phrases.join(" and ");
}

export type PartsEditorProps = {
  draft: RecipeDraft;
  onChange: (draft: RecipeDraft) => void;
  /** Units the ingredient rows suggest. */
  units?: readonly Unit[];
  errors?: FieldErrors;
  disabled?: boolean;
};

export function PartsEditor({ draft, onChange, units = [], errors = {}, disabled }: PartsEditorProps) {
  // Index of the part whose removal is awaiting confirmation.
  const [confirming, setConfirming] = useState<number | null>(null);
  const { parts } = draft;
  const pending = confirming === null ? undefined : parts[confirming];

  const remove = (index: number) => {
    setConfirming(null);
    onChange(removePart(draft, index));
  };

  const addButton = (
    <Button type="button" variant="outline" intent="neutral" size="sm" disabled={disabled} onClick={() => onChange(addPart(draft))}>
      Add part
    </Button>
  );

  // A flat recipe is its own main body: no heading, no name, no card. "Add
  // part" is the one control, and pressing it gives this part its chrome back
  // along with the new one's.
  if (isBare(draft)) {
    return (
      <section className="flex flex-col gap-4" aria-label="Parts" data-bare="">
        <IngredientsEditor draft={draft} pi={0} units={units} onChange={onChange} errors={errors} disabled={disabled} />
        <StepsEditor draft={draft} pi={0} onChange={onChange} errors={errors} disabled={disabled} />
        <div className="flex justify-end">{addButton}</div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Parts">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle as="h2">Parts</SectionTitle>
        {addButton}
      </div>

      {/* A draft normally keeps at least one part (the schema requires it); the fallback covers a draft that lost it. */}
      <EmptyBoundary
        isEmpty={parts.length === 0}
        fallback={
          <Muted as="p" className="text-sm">
            No parts yet
          </Muted>
        }
      >
        <ReorderList
          items={parts}
          keyOf={(part) => part.id ?? "unsaved"}
          itemName="part"
          onReorder={(next) => onChange({ ...draft, parts: next })}
          onRemove={
            parts.length > 1
              ? (part, index) => {
                  if (hasContent(part)) setConfirming(index);
                  else remove(index);
                }
              : undefined
          }
          renderItem={(part, index) => (
            <div className="flex flex-col gap-3 rounded-xl border border-border-normal p-3" data-part={index}>
              <Input
                name={`parts.${index}.name`}
                value={part.name ?? ""}
                placeholder="Part name"
                aria-label={`Part ${index + 1} name`}
                aria-invalid={errors[`parts.${index}.name`] !== undefined || undefined}
                autoComplete="off"
                disabled={disabled}
                onChange={(event) => onChange(renamePart(draft, index, event.target.value))}
              />
              {errors[`parts.${index}.name`] !== undefined && (
                <p className="text-sm text-fg-danger" role="alert">
                  {errors[`parts.${index}.name`]}
                </p>
              )}
              <IngredientsEditor draft={draft} pi={index} units={units} onChange={onChange} errors={errors} disabled={disabled} />
              <StepsEditor draft={draft} pi={index} onChange={onChange} errors={errors} disabled={disabled} />
            </div>
          )}
        />
      </EmptyBoundary>

      {pending !== undefined && confirming !== null && (
        <ConfirmDialog
          title={`Remove ${partLabel(pending, confirming)}?`}
          confirmLabel="Remove"
          aria-label="Remove part"
          onCancel={() => setConfirming(null)}
          onConfirm={() => remove(confirming)}
        >
          It has {contentSummary(pending)}, which go with it. This cannot be undone.
        </ConfirmDialog>
      )}
    </section>
  );
}
