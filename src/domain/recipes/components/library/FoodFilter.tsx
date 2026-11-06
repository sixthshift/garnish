import { SearchInput } from "@sixthshift/design-system/search-input";
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { cn } from "@sixthshift/design-system/utils";
import { useState } from "react";
import { addUnique, withoutId } from "../../../../lib/lists";
import { type PickerOption, picker } from "../../../../lib/ui/picker";
import type { FoodSummary } from "../../reference";

export type FoodFilterProps = {
  allFoods: readonly FoodSummary[];
  /** The food ids filtered by. */
  foods: readonly string[];
  onFoodsChange: (foods: string[]) => void;
  /** The field's width; the chips under it wrap to whatever they are given. */
  inputClassName?: string;
};

/** "Made with": type a food, pick it from the suggestions, and it becomes a chip that filters by it. The filter bar's and a desktop's filters column's. */
export function FoodFilter({ allFoods, foods, onFoodsChange, inputClassName }: FoodFilterProps) {
  const [foodText, setFoodText] = useState("");
  const foodById = new Map(allFoods.map((food) => [food.id, food]));
  const q = foodText.trim().toLowerCase();
  const options: PickerOption[] = allFoods
    .filter((food) => !foods.includes(food.id) && (q === "" || food.name.toLowerCase().includes(q)))
    .map((food) => ({ value: food.id, label: food.name }));

  return (
    <div className="flex flex-col gap-2">
      <SearchInput
        value={foodText}
        onValueChange={setFoodText}
        aria-label="Filter by food"
        placeholder="Filter by food"
        className={cn(inputClassName)}
        {...picker({
          options,
          text: foodText,
          label: "Food filter suggestions",
          onSelect: (option) => {
            onFoodsChange(addUnique(foods, option.value));
            setFoodText("");
          },
        })}
      />
      {foods.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Food filters">
          {foods.map((id) => (
            <li key={id}>
              <TagChip tag={foodById.get(id)?.name ?? id} onRemove={() => onFoodsChange(withoutId(foods, id))} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
