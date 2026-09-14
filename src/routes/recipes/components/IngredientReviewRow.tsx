// One pasted ingredient line inside the bulk-add sheet's review stage
// (M17.5). The parse is already done — `ReviewRow` carries what
// `parseIngredient` resolved and what it only proposed — so this is the
// decision UI: what matched shows as a chip, what did not shows the text the
// parser could not place, with "create it", "pick an existing one" (the same
// `Combobox` the inline row uses) and "leave it" side by side.
//
// Nothing here writes: every control returns a new `ReviewRow` through
// `onChange`, and the sheet's Add is the only thing that creates a food or a
// unit. The default for an unresolved slot is declined, so a reviewer who
// presses Add straight away adds no vocabulary at all — which is the point of
// the review step (decisions.md row 47).
//
// Split the way `IngredientFields`/`IngredientRow` are: `IngredientReviewFields`
// is a plain function of its props, with the decisions as `onChange` calls a
// test can invoke directly, and `IngredientReviewRow` adds the state around it
// — the mid-edit combobox text and the debounced food suggestions.
import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { useEffect, useState } from "react";
import type { Food as FoodRow } from "../../../db/models/food/repo";
import { type Choice, type ReviewRow, rowStatus } from "../../../domain/ingredient/bulkIngredients";
import type { Unit } from "../../../domain/recipe/recipe";
import { Combobox, type ComboboxOption } from "../../../components/ui/Combobox";

/** The review row type this component edits: units and foods as the editor knows them. */
export type IngredientReview = ReviewRow<Unit, FoodRow>;

/** How long the food picker waits after the last keystroke before querying. */
export const REVIEW_FOOD_DEBOUNCE_MS = 200;

/** The amount a row shows as a chip: "" for no amount, a leading `=` for a fixed one. Pure. */
export function amountChip(row: IngredientReview): string {
  if (row.quantity === null) return "";
  return `${row.fixed ? "=" : ""}${row.quantity}`;
}

/** A chip's text: the chosen row's name, the name a create would use, or the fallback for a declined slot. Pure. */
export function chipText(choice: Choice<{ name: string }>, declined: string): string {
  if (choice.kind === "existing") return choice.row.name;
  if (choice.kind === "create") return `create “${choice.name}”`;
  return declined;
}

/** Chip colour by decision: a match is quiet, a pending create is brand, a declined slot is muted. Pure. */
export function chipIntent(kind: Choice<unknown>["kind"]): "neutral" | "brand" | "muted" {
  if (kind === "existing") return "neutral";
  return kind === "create" ? "brand" : "muted";
}

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

export type IngredientReviewRowProps = {
  row: IngredientReview;
  /** Label prefix for every control, e.g. "Line 2". */
  label: string;
  /** The units the editor loaded, filtered by the typed text. */
  unitMatches: (text: string) => readonly Unit[];
  /** Food suggestions for "pick existing"; the editor passes `listFoods`. */
  searchFoods: (q: string) => Promise<FoodRow[]>;
  disabled?: boolean;
  onChange: (row: IngredientReview) => void;
};

export function IngredientReviewRow({ row, label, unitMatches, searchFoods, disabled, onChange }: IngredientReviewRowProps) {
  const [unitQuery, setUnitQuery] = useState(row.unitText);
  const [foodQuery, setFoodQuery] = useState(row.foodText);
  const [foodFocused, setFoodFocused] = useState(false);
  const [foodRows, setFoodRows] = useState<FoodRow[]>([]);

  // Query foods while the picker has focus, a beat after the last keystroke.
  useEffect(() => {
    const q = foodQuery.trim();
    if (!foodFocused || q === "") {
      setFoodRows([]);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      searchFoods(q)
        .then((rows) => {
          if (!stale) setFoodRows(rows);
        })
        .catch(() => {
          if (!stale) setFoodRows([]);
        });
    }, REVIEW_FOOD_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [foodQuery, foodFocused, searchFoods]);

  const units = unitMatches(unitQuery);

  return (
    <IngredientReviewFields
      row={row}
      label={label}
      unitQuery={unitQuery}
      foodQuery={foodQuery}
      disabled={disabled}
      unitOptions={units.map((unit) => ({ value: unit.id, label: unit.name, hint: unit.abbreviation || undefined }))}
      foodOptions={foodRows.map((food) => ({ value: food.id, label: food.name }))}
      onUnitQuery={setUnitQuery}
      onFoodQuery={setFoodQuery}
      onFoodFocus={() => setFoodFocused(true)}
      onFoodBlur={() => setFoodFocused(false)}
      onPickUnit={(option) => {
        const unit = units.find((candidate) => candidate.id === option.value);
        if (!unit) return;
        setUnitQuery(unit.name);
        onChange({ ...row, unit: { kind: "existing", row: unit } });
      }}
      onPickFood={(option) => {
        const food = foodRows.find((candidate) => candidate.id === option.value);
        if (!food) return;
        setFoodQuery(food.name);
        onChange({ ...row, food: { kind: "existing", row: food } });
      }}
      onChange={onChange}
    />
  );
}
