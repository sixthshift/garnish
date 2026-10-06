import { useEffect, useState } from "react";
import type { IngredientReview } from "../../../domain/draft";
import type { FoodRow, Unit } from "../../../domain/reference";
import { asText, IngredientReviewFields, NO_UNIT, withoutUnit } from "./IngredientReviewFields";

/** How long the food picker waits after the last keystroke before querying. */
export const REVIEW_FOOD_DEBOUNCE_MS = 200;

/** The words of a food phrase worth searching on their own: "caster sugar, sifted" → caster, sugar, sifted. Pure. */
export function foodSearchWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((word) => word.length >= 3);
  return [...new Set(words)];
}

/**
 * The foods a picker's text suggests. Empty text lists every food, so a picker
 * can be browsed; text lists the foods whose name contains it; and when the
 * page's whole phrase matches nothing, the foods matching any of its words,
 * those matching the most first — "caster sugar, sifted" still offers "sugar".
 */
export async function suggestFoods(searchFoods: (q: string) => Promise<FoodRow[]>, text: string): Promise<FoodRow[]> {
  const q = text.trim();
  const whole = await searchFoods(q);
  const words = foodSearchWords(q);
  if (whole.length > 0 || words.length < 2) return whole;
  const hits = new Map<string, { food: FoodRow; count: number }>();
  for (const rows of await Promise.all(words.map((word) => searchFoods(word)))) {
    for (const food of rows) {
      const hit = hits.get(food.id);
      if (hit) hit.count += 1;
      else hits.set(food.id, { food, count: 1 });
    }
  }
  return [...hits.values()].sort((a, b) => b.count - a.count || a.food.name.localeCompare(b.food.name)).map((hit) => hit.food);
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
  // Each picker starts from what the row holds: the chosen row's name, the name to create, or the page's word.
  const [unitQuery, setUnitQuery] = useState(choiceText(row.unit, row.unitText));
  const [foodQuery, setFoodQuery] = useState(choiceText(row.food, row.foodText));
  const [foodFocused, setFoodFocused] = useState(false);
  const [foodRows, setFoodRows] = useState<FoodRow[]>([]);

  // Query foods while the picker has focus, a beat after the last keystroke.
  useEffect(() => {
    if (!foodFocused) {
      setFoodRows([]);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      suggestFoods(searchFoods, foodQuery)
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
        if (option.value === NO_UNIT.value) {
          setUnitQuery("");
          onChange(withoutUnit(row));
          return;
        }
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
      onLeaveAsText={() => {
        setFoodQuery("");
        onChange(asText(row));
      }}
      onChange={onChange}
    />
  );
}

/** What a picker shows for a slot: the chosen row's name, the name to create, or the parser's text. Pure. */
function choiceText(choice: IngredientReview["unit"] | IngredientReview["food"], text: string): string {
  if (choice.kind === "existing") return choice.row.name;
  return choice.kind === "create" ? choice.name : text;
}
