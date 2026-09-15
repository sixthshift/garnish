import { useEffect, useState } from "react";
import type { IngredientReview } from "../../../domain/draft";
import type { FoodRow, Unit } from "../../../domain/reference";
import { IngredientReviewFields } from "./IngredientReviewFields";

/** How long the food picker waits after the last keystroke before querying. */
export const REVIEW_FOOD_DEBOUNCE_MS = 200;

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
