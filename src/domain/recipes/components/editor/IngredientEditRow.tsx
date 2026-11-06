// One ingredient row in the editor, one line on a desktop and in a sheet below it; the view page's row is recipe/components/IngredientRow.tsx.

import { Button } from "@sixthshift/design-system/button";
import { Select } from "@sixthshift/design-system/select";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Toggle } from "@sixthshift/design-system/toggle";
import { cn } from "@sixthshift/design-system/utils";
import { useEffect, useState } from "react";
import { ChevronRight } from "../../../../components/ui/icons";
import { Menu } from "../../../../components/ui/Menu";
import type { ReorderRow } from "../../../../components/ui/ReorderList";
import type { PickerOption } from "../../../../lib/ui/picker";
import { useLayout } from "../../../../lib/useLayout";
import { type DraftIngredient, type FieldErrors, ingredientSummary } from "../../draft";
import type { Unit } from "../../reference";
import { PendingLine, useImportCheck } from "./ImportCheck";
import { IngredientAlternativesSheet } from "./IngredientAlternativesSheet";
import { EMPTY_INGREDIENT_SUMMARY, INGREDIENT_COLUMNS, IngredientFields } from "./IngredientFields";
import { useIngredientEditRow } from "./useIngredientEditRow";

export type IngredientEditRowProps = {
  ingredient: DraftIngredient;
  pi: number;
  ii: number;
  units: readonly Unit[];
  /** The other parts, as "move to" options (value is the part index). */
  parts: PickerOption[];
  /** The list's drag handle and moves, which this row places: the handle first, the moves in its menu on a narrow list only (a wide one has its up and down buttons). */
  reorder?: ReorderRow;
  /** Remove, in the menu on a narrow list (a wide one has its own button). */
  onRemove?: () => void;
  errors: FieldErrors;
  disabled?: boolean;
  onPatch: (patch: Partial<DraftIngredient>) => void;
  onMove: (toPi: number) => void;
  /** Enter on the row's last field. */
  onEnter?: () => void;
};

export function IngredientEditRow({ ingredient, pi, ii, units, parts, reorder, onRemove, errors, disabled, onPatch, onMove, onEnter }: IngredientEditRowProps) {
  const path = `parts.${pi}.ingredients.${ii}`;
  const label = `Ingredient ${ii + 1}`;
  const check = useImportCheck();
  // Check's Pick opens the row it just filled, so the food can be changed at once.
  const [sheetOpen, setSheetOpen] = useState(() => check !== null && ingredient.id !== undefined && check.picking === ingredient.id);
  useEffect(() => {
    if (check !== null && ingredient.id !== undefined && check.picking === ingredient.id) check.donePicking();
  }, [check, ingredient.id]);
  const [alternativesOpen, setAlternativesOpen] = useState(false);
  const alternativeCount = ingredient.alternatives?.length ?? 0;
  const { textOnly, setMode, fieldProps } = useIngredientEditRow({ ingredient, path, label, units, errors, disabled, onPatch, onEnter });

  const modeToggle = (
    <Toggle
      type="button"
      variant="ghost"
      intent="neutral"
      size="sm"
      aria-label={`${label} text only`}
      pressed={textOnly}
      disabled={disabled}
      onPressedChange={setMode}
    >
      Text
    </Toggle>
  );

  const moveTo =
    parts.length > 0 ? (
      <Select
        aria-label={`Move ${label.toLowerCase()} to part`}
        options={parts}
        placeholder="Move to…"
        disabled={disabled}
        className="w-36"
        onValueChange={(value) => onMove(Number(value))}
      />
    ) : null;

  // The sheet's controls. On a desktop the line's live in the row's menu.
  const controls = (
    <>
      {modeToggle}
      {moveTo}
    </>
  );

  const desktop = useLayout() === "desktop";
  const summary = ingredientSummary(ingredient);
  const parse = fieldProps.parse;

  // On a desktop the menu holds what the line leaves out (Fixed, Text only,
  // Parse, Move to); a phone's sheet has them, so its menu does not. On a
  // narrow list (ReorderList's `@2xl` container) it also holds the moves and
  // Remove.
  const menu = (
    <Menu label={`${label} actions`} iconOnly className="flex w-9 shrink-0 justify-end">
      {desktop && (
        <>
          <Menu.Item
            checked={ingredient.fixed === true && !textOnly}
            disabled={disabled === true || textOnly}
            onSelect={() => onPatch({ fixed: ingredient.fixed !== true })}
          >
            Fixed <span className="text-fg-subtle">· doesn't scale</span>
          </Menu.Item>
          <Menu.Item checked={textOnly} disabled={disabled} onSelect={() => setMode(!textOnly)}>
            Text only
          </Menu.Item>
          {parse !== undefined && parse.review === null && (
            <Menu.Item disabled={disabled === true || parse.busy} onSelect={parse.onStart}>
              Parse
            </Menu.Item>
          )}
        </>
      )}
      {/* Every width: the phone's sheet does not hold it. A text-only line has no food to stand in for. */}
      <Menu.Item disabled={disabled === true || textOnly || !ingredient.food} onSelect={() => setAlternativesOpen(true)}>
        Alternatives{alternativeCount > 0 && <span className="text-fg-subtle"> · {alternativeCount}</span>}
      </Menu.Item>
      {desktop && parts.length > 0 && <Menu.Separator />}
      {desktop &&
        parts.map((part) => (
          <Menu.Item key={part.value} disabled={disabled} onSelect={() => onMove(Number(part.value))}>
            Move to {part.label}
          </Menu.Item>
        ))}
      {reorder !== undefined && (
        <>
          {desktop && <Menu.Separator className="@2xl:hidden" />}
          <Menu.Item disabled={!reorder.moveUp} onSelect={reorder.moveUp} className="@2xl:hidden">
            Move up
          </Menu.Item>
          <Menu.Item disabled={!reorder.moveDown} onSelect={reorder.moveDown} className="@2xl:hidden">
            Move down
          </Menu.Item>
        </>
      )}
      {/* Neutral: it changes the unsaved draft, which Cancel restores (rule 5 keeps red for a confirm). */}
      {onRemove !== undefined && (
        <Menu.Item onSelect={onRemove} className="@2xl:hidden">
          Remove
        </Menu.Item>
      )}
    </Menu>
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 desktop:items-start" data-ingredient={ii} data-mode={textOnly ? "text" : "structured"}>
        {reorder !== undefined && <span className="flex shrink-0 desktop:pt-1">{reorder.handle}</span>}
        <div className="min-w-0 flex-1">
          {/* Phone: one line per row, tapped to open the sheet. On a desktop the fields sit on one line. */}
          {desktop ? (
            <div data-inline-fields="">
              <IngredientFields {...fieldProps} layout="line" />
            </div>
          ) : (
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 py-1 text-left text-sm"
              aria-label={`Edit ${label.toLowerCase()}`}
              aria-expanded={sheetOpen}
              disabled={disabled}
              onClick={() => setSheetOpen(true)}
            >
              <span className="truncate">{summary === "" ? EMPTY_INGREDIENT_SUMMARY : summary}</span>
              <ChevronRight title="Open" />
            </button>
          )}
        </div>
        {menu}
        <IngredientAlternativesSheet
          open={alternativesOpen}
          onOpenChange={setAlternativesOpen}
          ingredient={ingredient}
          label={label}
          units={units}
          onPatch={onPatch}
        />
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen} size="sm" closable aria-label={label}>
          <Sheet.Header>
            <h2 className="text-base font-medium">{label}</h2>
          </Sheet.Header>
          <Sheet.Body>
            <IngredientFields {...fieldProps} controls={controls} showOriginalText />
          </Sheet.Body>
          <Sheet.Footer>
            <Button type="button" variant="solid" intent="brand" onClick={() => setSheetOpen(false)}>
              Done
            </Button>
          </Sheet.Footer>
        </Sheet>
      </div>
      {check !== null && ingredient.id !== undefined && <PendingLine id={ingredient.id} label={label} state={check} disabled={disabled} />}
    </div>
  );
}

/**
 * The column labels over the editor's lines, laid out like a row (room for the
 * handle, the fields' grid, room for the menu), so Amount sits over every
 * amount. Shown only where the four columns are: on a desktop, and where the row is
 * wide enough for them. Each field still names itself ("Ingredient 3 food").
 */
export function IngredientColumnsHeader() {
  return (
    <div className="flex items-end gap-2 text-xs font-medium text-fg-subtle">
      <span className="w-6 shrink-0" />
      <div className="@container/fields min-w-0 flex-1">
        <div className={cn(INGREDIENT_COLUMNS, "mb-2 hidden @min-[36rem]/fields:grid")}>
          <span className="px-1">Amount</span>
          <span className="px-1">Unit</span>
          <span className="px-1">Food</span>
          <span className="px-1">Note</span>
        </div>
      </div>
      <span className="w-9 shrink-0" />
    </div>
  );
}
