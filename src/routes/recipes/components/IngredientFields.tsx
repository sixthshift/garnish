import { Badge } from "@sixthshift/design-system/badge";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import type { KeyboardEvent, ReactNode } from "react";
import { type DraftIngredient, type FieldErrors, ingredientSummary } from "../../../domain/draft";
import type { FoodRow, Unit } from "../../../domain/reference";
import { amountFields } from "./ingredientAmountFields";
import { type ParseAction, parseAction } from "./ingredientReview";

/** How long the food input waits after the last keystroke before querying. */
export const FOOD_SEARCH_DEBOUNCE_MS = 200;

/** What a row with nothing in it yet shows on its summary line. */
export const EMPTY_INGREDIENT_SUMMARY = "New ingredient";

/**
 * The editor's one-line row and its column header share these, so the list
 * reads as a table: amount narrow, unit 9.5rem (room for "tablespoon" beside the
 * search icon and the clear button), food and note sharing the rest 3:2.
 * Below 33rem of the row's own width (`@container/fields`), where the food
 * would show fewer than about fifteen letters, the note drops to a second line
 * under amount, unit and food, and the header is hidden.
 */
export const INGREDIENT_COLUMNS =
  "grid gap-2 grid-cols-[4.5rem_minmax(0,9.5rem)_minmax(0,1fr)] @min-[33rem]/fields:grid-cols-[4.5rem_9.5rem_minmax(0,3fr)_minmax(0,2fr)]";

/** True when a row's imported line says something its fields do not, so the line is worth showing under it. */
export function originalTextDiffers(ingredient: DraftIngredient): boolean {
  // Letters and digits only, so "200g flour" is not shown again under "200 g flour".
  const flat = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const original = flat(ingredient.originalText ?? "");
  return original !== "" && original !== flat(ingredientSummary(ingredient));
}

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
  /** The mode toggle and "move to" select, built by the row. Stacked only: the line's live in the row's menu. */
  controls?: ReactNode;
  /** Adds the read-only `originalText` line under the fields; the phone sheet sets it. */
  showOriginalText?: boolean;
  /**
   * "stack" (default): the sheets' fields, a line each. "line": the editor's
   * row from `md`, amount, unit, food and note on one line in the
   * `INGREDIENT_COLUMNS` grid, with a quiet line under it only for a Fixed
   * row or an imported line that says more than the fields.
   */
  layout?: "stack" | "line";
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
  const { ingredient, path, label, units, errors, disabled, textOnly, controls, showOriginalText, layout = "stack", parse, onEnter } = props;
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
  const noteField = (className?: string) => (
    <Input
      name={`${path}.note`}
      aria-label={`${label} note`}
      placeholder={layout === "line" ? "Note" : "Note, e.g. sifted"}
      autoComplete="off"
      className={className}
      value={ingredient.note ?? ""}
      disabled={disabled}
      onKeyDown={enterKey}
      onChange={(event) => props.onPatch({ note: event.target.value })}
    />
  );
  const textField = (
    <Input
      name={`${path}.originalText`}
      aria-label={`${label} text`}
      placeholder="e.g. a pinch of salt"
      autoComplete="off"
      className={layout === "line" ? "col-span-full" : undefined}
      value={ingredient.originalText ?? ""}
      disabled={disabled}
      onKeyDown={enterKey}
      onChange={(event) => props.onPatch({ originalText: event.target.value })}
    />
  );

  if (layout === "line") {
    // A text-only row is one wide field, so its mode shows on the line itself;
    // Fixed, rarer and invisible in the fields, gets a badge under it.
    const fixed = !textOnly && ingredient.fixed === true;
    const showOriginal = !textOnly && originalTextDiffers(ingredient);
    return (
      <div className="@container/fields flex flex-col gap-1">
        <div className={INGREDIENT_COLUMNS}>
          {textOnly ? (
            textField
          ) : (
            <>
              {amountFields(props, quantityError, "line")}
              {noteField("col-span-full @min-[33rem]/fields:col-span-1")}
            </>
          )}
          {quantityError !== undefined && (
            <p className="col-span-full text-sm text-fg-danger" role="alert">
              {quantityError}
            </p>
          )}
        </div>
        {(fixed || showOriginal) && (
          <div className="flex min-w-0 items-center gap-2 text-xs text-fg-subtle">
            {fixed && (
              <Badge variant="soft" intent="neutral" size="sm" className="shrink-0" data-fixed-badge="">
                Fixed
              </Badge>
            )}
            {showOriginal && (
              <span className="truncate" title={originalText} data-original-text-below="">
                {originalText}
              </span>
            )}
          </div>
        )}
        {parse !== undefined && parseAction(parse, label, units, disabled, "review")}
      </div>
    );
  }

  if (textOnly) {
    return (
      <div className="flex flex-col gap-2">
        {textField}
        {controls !== undefined && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
        {parse !== undefined && parseAction(parse, label, units, disabled, "button")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {amountFields(props, quantityError)}
      {quantityError !== undefined && (
        <p className="text-sm text-fg-danger" role="alert">
          {quantityError}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {noteField("min-w-40 grow")}
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
