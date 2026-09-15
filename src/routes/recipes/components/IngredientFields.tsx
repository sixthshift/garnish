import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import type { KeyboardEvent, ReactNode } from "react";
import type { DraftIngredient, FieldErrors } from "../../../domain/draft";
import type { FoodRow, Unit } from "../../../domain/reference";
import { amountFields } from "./ingredientAmountFields";
import { type ParseAction, parseAction } from "./ingredientReview";

/** How long the food input waits after the last keystroke before querying. */
export const FOOD_SEARCH_DEBOUNCE_MS = 200;

/** What a row with nothing in it yet shows on its summary line. */
export const EMPTY_INGREDIENT_SUMMARY = "New ingredient";

/**
 * The fields of one ingredient row. Rendered inline from `md` up and inside
 * the phone sheet below it, so both widths edit the same row through the same
 * `onPatch`. No state of its own: the row owns the mid-edit text and the food
 * suggestions, which keeps this a plain function a test can call directly.
 */
export type IngredientFieldsProps = {
  ingredient: DraftIngredient;
  /** Field name prefix, e.g. "parts.0.ingredients.1". */
  path: string;
  /** Label prefix for every control, e.g. "Ingredient 2". */
  label: string;
  units: readonly Unit[];
  errors: FieldErrors;
  disabled?: boolean;
  /** True for a text-only row: one free line instead of the amount fields. */
  textOnly: boolean;
  /** The quantity text while it is being typed; null falls back to the committed value. */
  quantityDraft: string | null;
  unitText: string;
  foodText: string;
  /** Food suggestions the row has fetched. */
  foodRows: readonly FoodRow[];
  /** The mode toggle and "move to" select, built by the row. */
  controls?: ReactNode;
  /** Adds the read-only `originalText` line under the fields; the phone sheet sets it. */
  showOriginalText?: boolean;
  /** Adds the grey `originalText` line above a parsed row's fields; the inline (`md` and up) row sets it. */
  originalTextAbove?: boolean;
  /**
   * Enter on the row's last field: appends a row and focuses it from
   * the last row, moves to the next row from any earlier one. Absent where
   * there is no list to append to.
   */
  onEnter?: () => void;
  /** The "Parse" action for a text-only row, present only when the row has something to parse. */
  parse?: ParseAction;
  onPatch: (patch: Partial<DraftIngredient>) => void;
  onQuantityText: (text: string | null) => void;
  onUnitText: (text: string) => void;
  onUnitBlur: () => void;
  onFoodText: (text: string) => void;
  onFoodFocus: () => void;
  onFoodBlur: () => void;
};

export function IngredientFields(props: IngredientFieldsProps) {
  const { ingredient, path, label, units, errors, disabled, textOnly, controls, showOriginalText, originalTextAbove, parse, onEnter } = props;
  // Enter in a single-line field submits the form by default; the list's own
  // meaning for it has to say so explicitly.
  const enterKey =
    onEnter === undefined
      ? undefined
      : (event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key !== "Enter" || event.shiftKey) return;
          event.preventDefault();
          onEnter();
        };
  const quantityError = errors[`${path}.quantity`];

  const originalText = (ingredient.originalText ?? "").trim();
  const originalLine =
    showOriginalText === true && !textOnly ? (
      <div className="flex flex-col gap-0.5" data-original-text="">
        <Muted as="span" className="text-xs font-medium uppercase tracking-wide">
          Original text
        </Muted>
        <p className="text-sm text-fg-subtle">{originalText === "" ? "—" : originalText}</p>
      </div>
    ) : null;
  const originalTextLine =
    originalTextAbove === true && !textOnly && originalText !== "" ? (
      <p className="text-sm text-fg-subtle" data-original-text-above="">
        {originalText}
      </p>
    ) : null;

  if (textOnly) {
    return (
      <div className="flex flex-col gap-2">
        <Input
          name={`${path}.originalText`}
          aria-label={`${label} text`}
          placeholder="e.g. a pinch of salt"
          autoComplete="off"
          value={ingredient.originalText ?? ""}
          disabled={disabled}
          onKeyDown={enterKey}
          onChange={(event) => props.onPatch({ originalText: event.target.value })}
        />
        {controls !== undefined && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
        {parse !== undefined && parseAction(parse, label, units, disabled, showOriginalText === true ? "button" : "menu")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {originalTextLine}
      {amountFields(props, quantityError)}
      {quantityError !== undefined && (
        <p className="text-sm text-fg-danger" role="alert">
          {quantityError}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name={`${path}.note`}
          aria-label={`${label} note`}
          placeholder="Note, e.g. sifted"
          autoComplete="off"
          className="min-w-40 grow"
          value={ingredient.note ?? ""}
          disabled={disabled}
          onKeyDown={enterKey}
          onChange={(event) => props.onPatch({ note: event.target.value })}
        />
        <Checkbox
          name={`${path}.fixed`}
          label="Fixed"
          aria-label={`${label} fixed`}
          checked={ingredient.fixed ?? false}
          disabled={disabled}
          onCheckedChange={(fixed) => props.onPatch({ fixed })}
        />
        {controls}
      </div>
      {originalLine}
    </div>
  );
}
