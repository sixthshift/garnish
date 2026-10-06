import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { SearchInput } from "@sixthshift/design-system/search-input";
import type { IngredientReview } from "../../../domain/draft";
import { rowStatus } from "../../../domain/ingredient";
import { type PickerOption, picker } from "../../../lib/ui/picker";
import { amountChip, chipIntent, chipText } from "./reviewChips";

export type IngredientReviewFieldsProps = {
  row: IngredientReview;
  /** Label prefix for every control, e.g. "Line 2". */
  label: string;
  /** Unit suggestions for the typed text. */
  unitOptions: readonly PickerOption[];
  /** Food suggestions the row has fetched. */
  foodOptions: readonly PickerOption[];
  /** The text in each picker while it is being typed. */
  unitQuery: string;
  foodQuery: string;
  disabled?: boolean;
  onUnitQuery: (text: string) => void;
  onFoodQuery: (text: string) => void;
  onFoodFocus: () => void;
  onFoodBlur: () => void;
  /** A suggestion was picked; the row resolves it to a vocabulary row, or to none for `NO_UNIT`. */
  onPickUnit: (option: PickerOption) => void;
  onPickFood: (option: PickerOption) => void;
  /** No food: the line is kept as the page wrote it. */
  onLeaveAsText: () => void;
  onChange: (row: IngredientReview) => void;
};

export function IngredientReviewFields(props: IngredientReviewFieldsProps) {
  const { row, label, unitOptions, foodOptions, unitQuery, foodQuery, disabled, onChange } = props;
  const amount = amountChip(row);

  return (
    <div className="flex flex-col gap-2" data-review-row="" data-status={rowStatus(row)}>
      <p className="text-sm text-fg-subtle" data-original-text="">
        {row.originalText}
      </p>
      <div className="flex flex-wrap items-center gap-1.5" data-chips="">
        {amount !== "" && (
          <Badge variant="soft" intent="neutral">
            {amount}
          </Badge>
        )}
        <Badge variant={row.unit.kind === "existing" ? "soft" : "outline"} intent={chipIntent(row.unit.kind)}>
          {chipText(row.unit, "no unit")}
        </Badge>
        <Badge variant={row.food.kind === "existing" ? "soft" : "outline"} intent={chipIntent(row.food.kind)}>
          {chipText(row.food, "text only")}
        </Badge>
        {row.note !== "" && (
          <Badge variant="outline" intent="neutral">
            {row.note}
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-1" data-field="unit">
        <SearchInput
          aria-label={`${label} unit`}
          placeholder="Unit"
          className="min-w-40"
          value={unitQuery}
          disabled={disabled}
          onValueChange={props.onUnitQuery}
          {...picker({
            options: [NO_UNIT, ...unitOptions],
            text: unitQuery,
            onSelect: props.onPickUnit,
            onCreate: (name) => onChange({ ...row, unit: { kind: "create", name } }),
          })}
        />
        {row.unit.kind === "none" && row.unitText !== "" && (
          <Muted as="span" className="text-xs" data-unknown="unit">
            {`“${row.unitText}” isn’t one of your units. Pick one, create it, or choose No unit.`}
          </Muted>
        )}
      </div>

      <div className="flex flex-col gap-1" data-field="food">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            aria-label={`${label} food`}
            placeholder="Food"
            className="min-w-40 grow basis-40"
            value={foodQuery}
            disabled={disabled}
            onValueChange={props.onFoodQuery}
            onFocus={props.onFoodFocus}
            onBlur={props.onFoodBlur}
            {...picker({
              options: foodOptions,
              text: foodQuery,
              onSelect: props.onPickFood,
              onCreate: (name) => onChange({ ...row, food: { kind: "create", name } }),
            })}
          />
          {(row.food.kind !== "none" || row.foodText !== "") && (
            <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled} onClick={props.onLeaveAsText}>
              Leave as text
            </Button>
          )}
        </div>
        {row.food.kind === "none" && row.foodText !== "" && (
          <Muted as="span" className="text-xs" data-unknown="food">
            {`“${row.foodText}” isn’t one of your foods. Pick one, create it, or leave the line as the page wrote it.`}
          </Muted>
        )}
      </div>
    </div>
  );
}

/** The unit picker's first row: a line can have no unit ("1 carrot"), and saying so is a pick like any other. */
export const NO_UNIT: PickerOption = { value: "no-unit", label: "No unit" };

/** The row with no unit, any word the parser took for one moved to the front of the note. Pure. */
export function withoutUnit(row: IngredientReview): IngredientReview {
  if (row.unit.kind === "existing") return { ...row, unit: { kind: "none" }, unitText: "" };
  const note = [row.unitText, row.note].filter((part) => part !== "").join(", ");
  return { ...row, unit: { kind: "none" }, unitText: "", note };
}

/** The row with no food: a text-only line, nothing proposed for it. Pure. */
export function asText(row: IngredientReview): IngredientReview {
  return { ...row, food: { kind: "none" }, foodText: "" };
}
