// Filter bar for the recipe list (M12.3): tag chips with an any/all switch,
// a food picker built on the existing `Combobox`, and a favourites toggle.
// Fully controlled — the route owns the search params and re-navigates on
// every change; this component only renders the current state and reports
// intent upward.
import { Switch } from "@sixthshift/design-system/switch";
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { useState } from "react";
import { Combobox } from "../../../components/ui/Combobox";
import type { Food } from "../../../db/models/food/repo";
import type { TagMatch } from "../../../domain/recipe";
import type { Tag } from "../../../domain/reference";
import { addUnique, withoutId } from "../../../lib/lists";
import type { ComboboxOption } from "../../../lib/ui/combobox";

export type FilterBarProps = {
  allTags: readonly Tag[];
  allFoods: readonly Food[];
  tags: readonly string[];
  match: TagMatch;
  foods: readonly string[];
  favourite: boolean;
  onTagsChange: (tags: string[]) => void;
  onMatchChange: (match: TagMatch) => void;
  onFoodsChange: (foods: string[]) => void;
  onFavouriteChange: (favourite: boolean) => void;
};

export function FilterBar({ allTags, allFoods, tags, match, foods, favourite, onTagsChange, onMatchChange, onFoodsChange, onFavouriteChange }: FilterBarProps) {
  const [foodText, setFoodText] = useState("");
  const foodById = new Map(allFoods.map((food) => [food.id, food]));
  const q = foodText.trim().toLowerCase();
  const options: ComboboxOption[] = allFoods
    .filter((food) => !foods.includes(food.id) && (q === "" || food.name.toLowerCase().includes(q)))
    .map((food) => ({ value: food.id, label: food.name }));

  return (
    <div className="flex flex-col gap-3">
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="multiple"
            aria-label="Filter by tag"
            appearance="separate"
            variant="outline"
            intent="neutral"
            size="sm"
            className="flex-wrap"
            value={[...tags]}
            onValueChange={onTagsChange}
            options={allTags.map((tag) => ({ value: tag.slug, label: tag.name }))}
          />
          <Switch checked={match === "all"} onCheckedChange={(checked) => onMatchChange(checked ? "all" : "any")} label="Match all" />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Combobox
          value={foodText}
          onChange={setFoodText}
          options={options}
          aria-label="Filter by food"
          placeholder="Filter by food"
          onSelect={(option) => {
            onFoodsChange(addUnique(foods, option.value));
            setFoodText("");
          }}
          className="max-w-xs"
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
      <Switch checked={favourite} onCheckedChange={onFavouriteChange} label="Favourites only" />
    </div>
  );
}
