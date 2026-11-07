import { Button } from "@sixthshift/design-system/button";
import { Input } from "@sixthshift/design-system/input";
import { useState } from "react";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog";
import { Menu } from "../../../../components/ui/Menu";
import { addPart, type DraftPart, type FieldErrors, hasContent, isBare, movePart, type RecipeDraft, removePart, renamePart } from "../../draft";
import type { Unit } from "../../reference";
import { IngredientsEditor } from "./IngredientsEditor";
import { StepsEditor } from "./StepsEditor";

// The recipe's parts split as the recipe page splits them (decisions.md row
// 211): every part's ingredients in one column, every part's steps in the
// next. A part is named, moved and removed where its steps are; its name heads
// its ingredients too, read only, so the two columns never hold two boxes for
// one name. A flat recipe (one unnamed part) shows no parts at all.

export type PartsColumnProps = {
  draft: RecipeDraft;
  onChange: (draft: RecipeDraft) => void;
  units?: readonly Unit[];
  errors?: FieldErrors;
  disabled?: boolean;
};

const stepCount = (draft: RecipeDraft) => draft.parts.reduce((count, part) => count + part.steps.length, 0);
const ingredientCount = (draft: RecipeDraft) => draft.parts.reduce((count, part) => count + part.ingredients.length, 0);

/** The column's label, in the page's small capitals, with how many it holds. */
function ColumnLabel({ children }: { children: string }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{children}</h2>;
}

/** Every part's ingredients, under the part's name once there is more than one part. */
export function IngredientsColumn({ draft, onChange, units = [], errors = {}, disabled }: PartsColumnProps) {
  const bare = isBare(draft);
  return (
    <section className="flex flex-col gap-6" aria-label="Ingredients" data-testid="ingredients-editor">
      {!bare && <ColumnLabel>{`Ingredients · ${ingredientCount(draft)}`}</ColumnLabel>}
      {draft.parts.map((part, pi) => (
        <div key={part.id ?? pi} className="flex flex-col gap-2" data-part={pi}>
          <IngredientsEditor
            draft={draft}
            pi={pi}
            units={units}
            onChange={onChange}
            errors={errors}
            disabled={disabled}
            heading={bare ? "Ingredients" : partLabel(part, pi)}
            quietWhenEmpty={!bare}
          />
        </div>
      ))}
    </section>
  );
}

/** Every part's steps, each part named above them with its moves and Remove; Add part at the foot. */
export function MethodColumn({ draft, onChange, errors = {}, disabled }: PartsColumnProps) {
  // Index of the part whose removal is awaiting confirmation.
  const [confirming, setConfirming] = useState<number | null>(null);
  const bare = isBare(draft);
  const { parts } = draft;
  const pending = confirming === null ? undefined : parts[confirming];
  const remove = (index: number) => {
    setConfirming(null);
    onChange(removePart(draft, index));
  };

  return (
    <section className="flex flex-col gap-6" aria-label="Method" data-testid="method-editor">
      {!bare && <ColumnLabel>{`Method · ${stepCount(draft)} ${stepCount(draft) === 1 ? "step" : "steps"}`}</ColumnLabel>}
      {parts.map((part, pi) => (
        <div key={part.id ?? pi} className="flex flex-col gap-3" data-part={pi}>
          {!bare && (
            <div className="flex items-center gap-2">
              <Input
                name={`parts.${pi}.name`}
                value={part.name ?? ""}
                placeholder={`Part ${pi + 1} name`}
                aria-label={`Part ${pi + 1} name`}
                aria-invalid={errors[`parts.${pi}.name`] !== undefined || undefined}
                autoComplete="off"
                disabled={disabled}
                className="font-display text-lg font-semibold"
                onChange={(event) => onChange(renamePart(draft, pi, event.target.value))}
              />
              <Menu label={`${partLabel(part, pi)} actions`} iconOnly>
                <Menu.Item disabled={disabled || pi === 0} onSelect={() => onChange(movePart(draft, pi, pi - 1))}>
                  Move part up
                </Menu.Item>
                <Menu.Item disabled={disabled || pi === parts.length - 1} onSelect={() => onChange(movePart(draft, pi, pi + 1))}>
                  Move part down
                </Menu.Item>
                <Menu.Item disabled={disabled || parts.length < 2} onSelect={() => (hasContent(part) ? setConfirming(pi) : remove(pi))}>
                  Remove part
                </Menu.Item>
              </Menu>
            </div>
          )}
          {errors[`parts.${pi}.name`] !== undefined && (
            <p className="text-sm text-fg-danger" role="alert">
              {errors[`parts.${pi}.name`]}
            </p>
          )}
          <StepsEditor
            draft={draft}
            pi={pi}
            onChange={onChange}
            errors={errors}
            disabled={disabled}
            heading={bare ? "Method" : "Steps"}
            quietWhenEmpty={!bare}
          />
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" intent="neutral" size="sm" disabled={disabled} onClick={() => onChange(addPart(draft))}>
          Add part
        </Button>
      </div>

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

/** "Pastry", or "part 2" for an unnamed one, for buttons and the confirm title. Pure. */
export function partLabel(part: DraftPart, index: number): string {
  const name = (part.name ?? "").trim();
  return name === "" ? `part ${index + 1}` : name;
}

/** "3 ingredients and 1 step", "1 ingredient", "2 steps". Pure. */
export function contentSummary(part: DraftPart): string {
  const phrases: string[] = [];
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  if (part.ingredients.length > 0) phrases.push(count(part.ingredients.length, "ingredient"));
  if (part.steps.length > 0) phrases.push(count(part.steps.length, "step"));
  return phrases.join(" and ");
}
