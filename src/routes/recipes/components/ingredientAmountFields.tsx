import { Input } from "@sixthshift/design-system/input";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { filterUnits, foodReference, parseQuantity, quantityText, unitReference } from "../../../domain/draft";
import { picker } from "../../../lib/ui/picker";
import type { IngredientFieldsProps } from "./IngredientFields";

/**
 * The structured row's amount line: quantity, unit and food, side by side.
 * A plain function of the row's props, like `parseAction`, so `IngredientFields`
 * stays a function a test can call directly and search.
 */
export function amountFields(props: IngredientFieldsProps, quantityError: string | undefined) {
  const { ingredient, path, label, units, disabled, quantityDraft, unitText, foodText, foodRows } = props;
  return (
    <div className="flex flex-wrap gap-2">
      <Input
        name={`${path}.quantity`}
        aria-label={`${label} quantity`}
        aria-invalid={quantityError !== undefined || undefined}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="Qty"
        className="w-20"
        value={quantityDraft ?? quantityText(ingredient.quantity)}
        disabled={disabled}
        onChange={(event) => {
          props.onQuantityText(event.target.value);
          props.onPatch({ quantity: parseQuantity(event.target.value) });
        }}
        onBlur={() => props.onQuantityText(null)}
      />
      <SearchInput
        name={`${path}.unit`}
        aria-label={`${label} unit`}
        placeholder="Unit"
        className="w-28 grow"
        value={unitText}
        disabled={disabled}
        onValueChange={props.onUnitText}
        onBlur={props.onUnitBlur}
        {...picker({
          options: filterUnits(units, unitText).map((unit) => ({ value: unit.id, label: unit.name, hint: unit.abbreviation || undefined })),
          text: unitText,
          onSelect: (option) => {
            const unit = units.find((u) => u.id === option.value);
            if (!unit) return;
            props.onUnitText(unit.name);
            props.onPatch({ unit });
          },
          onCreate: (text) => {
            props.onUnitText(text);
            props.onPatch({ unit: unitReference(text) });
          },
        })}
      />
      <SearchInput
        name={`${path}.food`}
        aria-label={`${label} food`}
        placeholder="Food"
        className="min-w-40 grow-2"
        value={foodText}
        disabled={disabled}
        onValueChange={props.onFoodText}
        onFocus={props.onFoodFocus}
        onBlur={props.onFoodBlur}
        {...picker({
          options: foodRows.map((row) => ({ value: row.id, label: row.name })),
          text: foodText,
          onSelect: (option) => {
            const row = foodRows.find((r) => r.id === option.value);
            if (!row) return;
            props.onFoodText(row.name);
            props.onPatch({ food: foodReference(row) });
          },
          onCreate: (text) => {
            props.onFoodText(text);
            props.onPatch({ food: foodReference({ name: text }) });
          },
        })}
      />
    </div>
  );
}
