// One ingredient row in the editor, one line from `md` and in a sheet below it; the view page's row is recipe/components/IngredientRow.tsx.

import { Button } from "@sixthshift/design-system/button";
import { Select } from "@sixthshift/design-system/select";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Toggle } from "@sixthshift/design-system/toggle";
import { cn } from "@sixthshift/design-system/utils";
import { useState } from "react";
import { ChevronRight } from "../../../components/ui/icons";
import { Menu } from "../../../components/ui/Menu";
import type { ReorderRow } from "../../../components/ui/ReorderList";
import { type DraftIngredient, type FieldErrors, ingredientSummary } from "../../../domain/draft";
import type { Unit } from "../../../domain/reference";
import type { PickerOption } from "../../../lib/ui/picker";
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
  const [sheetOpen, setSheetOpen] = useState(false);
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

  // The sheet's controls. From md the line's live in the row's menu.
  const controls = (
    <>
      {modeToggle}
      {moveTo}
    </>
  );

  const summary = ingredientSummary(ingredient);
  const parse = fieldProps.parse;

  // From md the menu holds what the line leaves out (Fixed, Text only, Parse,
  // Move to), each hidden below md, where the sheet has them; on a narrow list
  // (ReorderList's `@2xl` container) it also holds the moves and Remove.
  const menu = (
    <Menu label={`${label} actions`} iconOnly className="flex w-9 shrink-0 justify-end">
      <Menu.Item
        checked={ingredient.fixed === true && !textOnly}
        disabled={disabled === true || textOnly}
        className="max-md:hidden"
        onSelect={() => onPatch({ fixed: ingredient.fixed !== true })}
      >
        Fixed <span className="text-fg-subtle">· doesn't scale</span>
      </Menu.Item>
      <Menu.Item checked={textOnly} disabled={disabled} className="max-md:hidden" onSelect={() => setMode(!textOnly)}>
        Text only
      </Menu.Item>
      {parse !== undefined && parse.review === null && (
        <Menu.Item disabled={disabled === true || parse.busy} className="max-md:hidden" onSelect={parse.onStart}>
          Parse
        </Menu.Item>
      )}
      {parts.length > 0 && <Menu.Separator className="max-md:hidden" />}
      {parts.map((part) => (
        <Menu.Item key={part.value} disabled={disabled} className="max-md:hidden" onSelect={() => onMove(Number(part.value))}>
          Move to {part.label}
        </Menu.Item>
      ))}
      {reorder !== undefined && (
        <>
          <Menu.Separator className="max-md:hidden @2xl:hidden" />
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
    <div className="flex items-center gap-2 md:items-start" data-ingredient={ii} data-mode={textOnly ? "text" : "structured"}>
      {reorder !== undefined && <span className="flex shrink-0 md:pt-1">{reorder.handle}</span>}
      <div className="min-w-0 flex-1">
        {/* Phone: one line per row, tapped to open the sheet. From md the fields sit on one line. */}
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 py-1 text-left text-sm md:hidden"
          aria-label={`Edit ${label.toLowerCase()}`}
          aria-expanded={sheetOpen}
          disabled={disabled}
          onClick={() => setSheetOpen(true)}
        >
          <span className="truncate">{summary === "" ? EMPTY_INGREDIENT_SUMMARY : summary}</span>
          <ChevronRight title="Open" />
        </button>
        <div className="hidden md:block" data-inline-fields="">
          <IngredientFields {...fieldProps} layout="line" />
        </div>
      </div>
      {menu}
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
  );
}

/**
 * The column labels over the editor's lines, laid out like a row (room for the
 * handle, the fields' grid, room for the menu), so Amount sits over every
 * amount. Shown only where the four columns are: from md, and where the row is
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
