import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { Combobox } from "../../../components/ui/Combobox";
import type { IngredientReview } from "../../../domain/draft";
import { rowStatus } from "../../../domain/ingredient";
import type { ComboboxOption } from "../../../lib/ui/combobox";
import { amountChip, chipIntent, chipText } from "./reviewChips";

export type IngredientReviewFieldsProps = {
  row: IngredientReview;
  /** Label prefix for every control, e.g. "Line 2". */
  label: string;
  /** Unit suggestions for the typed text. */
  unitOptions: readonly ComboboxOption[];
  /** Food suggestions the row has fetched. */
  foodOptions: readonly ComboboxOption[];
  /** The text in each picker while it is being typed. */
  unitQuery: string;
  foodQuery: string;
  disabled?: boolean;
  onUnitQuery: (text: string) => void;
  onFoodQuery: (text: string) => void;
  onFoodFocus: () => void;
  onFoodBlur: () => void;
  /** A suggestion was picked; the row resolves it to a vocabulary row. */
  onPickUnit: (option: ComboboxOption) => void;
  onPickFood: (option: ComboboxOption) => void;
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

      {row.unitText !== "" && (
        <div className="flex flex-col gap-1" data-unknown="unit">
          <Muted as="span" className="text-xs">{`Unknown unit “${row.unitText}”`}</Muted>
          <div className="flex flex-wrap items-center gap-2">
            <Combobox
              aria-label={`${label} unit`}
              placeholder="Pick an existing unit"
              className="min-w-40 grow"
              value={unitQuery}
              disabled={disabled}
              options={unitOptions}
              onChange={props.onUnitQuery}
              onSelect={props.onPickUnit}
            />
            <Button
              type="button"
              variant="outline"
              intent="brand"
              size="sm"
              disabled={disabled}
              onClick={() => onChange({ ...row, unit: { kind: "create", name: row.unitText } })}
            >
              {`Create “${row.unitText}”`}
            </Button>
            {row.unit.kind !== "none" && (
              <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled} onClick={() => onChange({ ...row, unit: { kind: "none" } })}>
                No unit
              </Button>
            )}
          </div>
        </div>
      )}

      {row.foodText !== "" && (
        <div className="flex flex-col gap-1" data-unknown="food">
          <Muted as="span" className="text-xs">{`Unknown food “${row.foodText}”`}</Muted>
          <div className="flex flex-wrap items-center gap-2">
            <Combobox
              aria-label={`${label} food`}
              placeholder="Pick an existing food"
              className="min-w-40 grow"
              value={foodQuery}
              disabled={disabled}
              options={foodOptions}
              onChange={props.onFoodQuery}
              onFocus={props.onFoodFocus}
              onBlur={props.onFoodBlur}
              onSelect={props.onPickFood}
            />
            <Button
              type="button"
              variant="outline"
              intent="brand"
              size="sm"
              disabled={disabled}
              onClick={() => onChange({ ...row, food: { kind: "create", name: row.foodText } })}
            >
              {`Create “${row.foodText}”`}
            </Button>
            {row.food.kind !== "none" && (
              <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled} onClick={() => onChange({ ...row, food: { kind: "none" } })}>
                Leave as text
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
