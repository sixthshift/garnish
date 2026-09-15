// One ingredient row in the editor, inline from `md` and in a sheet below it; the view page's row is recipe/components/IngredientRow.tsx.

import { Button } from "@sixthshift/design-system/button";
import { Select } from "@sixthshift/design-system/select";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Toggle } from "@sixthshift/design-system/toggle";
import { useState } from "react";
import { ChevronRight } from "../../../components/ui/icons";
import { type DraftIngredient, type FieldErrors, ingredientSummary } from "../../../domain/draft";
import type { Unit } from "../../../domain/reference";
import type { ComboboxOption } from "../../../lib/ui/combobox";
import { EMPTY_INGREDIENT_SUMMARY, IngredientFields } from "./IngredientFields";
import { useIngredientEditRow } from "./useIngredientEditRow";

export type IngredientEditRowProps = {
  ingredient: DraftIngredient;
  pi: number;
  ii: number;
  units: readonly Unit[];
  /** The other parts, as "move to" options (value is the part index). */
  parts: ComboboxOption[];
  errors: FieldErrors;
  disabled?: boolean;
  onPatch: (patch: Partial<DraftIngredient>) => void;
  onMove: (toPi: number) => void;
  /** Enter on the row's last field. */
  onEnter?: () => void;
};

export function IngredientEditRow({ ingredient, pi, ii, units, parts, errors, disabled, onPatch, onMove, onEnter }: IngredientEditRowProps) {
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

  const controls = (
    <>
      {modeToggle}
      {moveTo}
    </>
  );

  const summary = ingredientSummary(ingredient);

  return (
    <div className="flex flex-col gap-2" data-ingredient={ii} data-mode={textOnly ? "text" : "structured"}>
      {/* Phone: one line per row, tapped to open the sheet. From md the fields sit inline. */}
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
      <div className="hidden md:flex md:flex-col md:gap-2" data-inline-fields="">
        <IngredientFields {...fieldProps} controls={controls} originalTextAbove />
      </div>
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
