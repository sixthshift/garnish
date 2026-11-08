// One ingredient row in the editor, one line on a desktop and in a sheet below it; the view page's row is recipe/components/IngredientRow.tsx.

import { Button } from "@sixthshift/design-system/button";
import { Select } from "@sixthshift/design-system/select";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Toggle } from "@sixthshift/design-system/toggle";
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
import { EMPTY_INGREDIENT_SUMMARY, IngredientFields } from "./IngredientFields";
import { checkedRead, useLineSource } from "./mobile/LineSource";
import { FlagDot, ReadLine } from "./mobile/ReadLine";
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
  const picking = check !== null && ingredient.id !== undefined && check.picking === ingredient.id;
  const [sheetOpen, setSheetOpen] = useState(picking);
  useEffect(() => {
    if (picking) check?.donePicking();
  }, [check, picking]);
  // A phone's Check: the line's sheet beside its page, whose Edit the line opens this row's fields.
  const lines = useLineSource();
  useEffect(() => {
    if (lines === null || ingredient.id === undefined || lines.editing !== ingredient.id) return;
    setSheetOpen(true);
    lines.doneEditing();
  }, [lines, ingredient.id]);
  // A desktop's line, open in place into its fields (decisions.md row 211); a phone's opens its sheet instead.
  // A line with nothing in it yet (just added) opens at once, to be typed into.
  const [inlineOpen, setInlineOpen] = useState(() => sheetOpen || ingredientSummary(ingredient) === "");
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
  const read = checkedRead(check, ingredient);
  const hasError = Object.keys(errors).some((key) => key.startsWith(`${path}.`));
  const readBack = read === null ? <span className="text-fg-subtle">{summary === "" ? EMPTY_INGREDIENT_SUMMARY : summary}</span> : <ReadLine read={read} />;
  const flagged = check?.flags.some((flag) => flag.id === ingredient.id) === true;

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
      {lines?.hasSource && ingredient.id !== undefined && <Menu.Item onSelect={() => lines.show(ingredient.id!)}>Where's this from?</Menu.Item>}
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
    // `data-row-id` is what a desktop's Check lights the source line by (desktop/EditorColumns).
    <div className="flex flex-col gap-1" data-row-id={ingredient.id}>
      <div className="flex items-center gap-2 desktop:items-start" data-ingredient={ii} data-mode={textOnly ? "text" : "structured"}>
        {reorder !== undefined && <span className="flex shrink-0 desktop:pt-1">{reorder.handle}</span>}
        <div className="min-w-0 flex-1">
          {/* Phone: one line per row, tapped to open the sheet. On a desktop the fields sit on one line. */}
          {desktop ? (
            // A line Save found wrong stays open, its error beside the field it is about.
            inlineOpen || sheetOpen || hasError ? (
              // Open: the line's fields where the line was, with what the page said under them.
              <div className="flex flex-col gap-2 rounded-lg border border-border-brand bg-bg-normal p-3 shadow-sm" data-inline-fields="">
                <IngredientFields {...fieldProps} showOriginalText />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    intent="neutral"
                    size="sm"
                    onClick={() => {
                      setInlineOpen(false);
                      setSheetOpen(false);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              // Closed: the line read back as the recipe page shows it; a click opens it.
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-md px-1 py-1 text-left text-base hover:bg-bg-subtle-hovered focus-visible:outline-2 focus-visible:outline-border-brand"
                aria-label={`Edit ${label.toLowerCase()}`}
                aria-expanded={false}
                disabled={disabled}
                onClick={() => setInlineOpen(true)}
                data-flagged={flagged ? "true" : undefined}
                data-read-back=""
              >
                {flagged && <FlagDot />}
                <span className="min-w-0 flex-1">{readBack}</span>
              </button>
            )
          ) : (
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 py-1 text-left text-sm"
              aria-label={`Edit ${label.toLowerCase()}`}
              aria-expanded={sheetOpen}
              disabled={disabled}
              onClick={() => setSheetOpen(true)}
              data-flagged={flagged ? "true" : undefined}
            >
              {/* How garnish read the line, apart: the amount as a chip, the food in bold, the note quieter (decisions.md row 208). */}
              {flagged && <FlagDot className="mt-0 self-center" />}
              <span className="min-w-0 flex-1">{readBack}</span>
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
        <Sheet open={sheetOpen && !desktop} onOpenChange={setSheetOpen} size="sm" closable aria-label={label}>
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
