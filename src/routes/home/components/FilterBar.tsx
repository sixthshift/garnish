import { Button } from "@sixthshift/design-system/button";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { Switch } from "@sixthshift/design-system/switch";
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { useState } from "react";
import type { TagMatch } from "../../../domain/recipe";
import type { FoodSummary, TagUsage } from "../../../domain/reference";
import { addUnique, withoutId } from "../../../lib/lists";
import { type PickerOption, picker } from "../../../lib/ui/picker";
import { tagShelves } from "./tagUse";

/** A tag as a toggle: its name, and how many recipes carry it. */
function tagOption(tag: TagUsage) {
  return {
    value: tag.slug,
    label: (
      <>
        {tag.name}
        <span className="text-fg-subtle tabular-nums">{tag.recipes}</span>
      </>
    ),
  };
}

export type FilterBarProps = {
  allTags: readonly TagUsage[];
  allFoods: readonly FoodSummary[];
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [tagText, setTagText] = useState("");
  const { top, more } = tagShelves(allTags, tags, tagText);
  const hidden = allTags.length - top.length;
  // Each group shows only its own tags; a change in one keeps the other's selection.
  const within = (group: readonly TagUsage[]) => new Set(group.map((tag) => tag.slug));
  const changeIn = (group: readonly TagUsage[]) => (next: string[]) => {
    const own = within(group);
    onTagsChange([...tags.filter((slug) => !own.has(slug)), ...next]);
  };
  const foodById = new Map(allFoods.map((food) => [food.id, food]));
  const q = foodText.trim().toLowerCase();
  const options: PickerOption[] = allFoods
    .filter((food) => !foods.includes(food.id) && (q === "" || food.name.toLowerCase().includes(q)))
    .map((food) => ({ value: food.id, label: food.name }));

  return (
    <div className="flex flex-col gap-3">
      {allTags.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="multiple"
              aria-label="Filter by tag"
              appearance="separate"
              variant="outline"
              intent="neutral"
              size="sm"
              className="flex-wrap"
              value={tags.filter((slug) => within(top).has(slug))}
              onValueChange={changeIn(top)}
              options={top.map(tagOption)}
            />
            {hidden > 0 && (
              <Button type="button" variant="ghost" intent="neutral" size="sm" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>
                {moreOpen ? "Fewer tags" : `More tags (${hidden})`}
              </Button>
            )}
            <Switch checked={match === "all"} onCheckedChange={(checked) => onMatchChange(checked ? "all" : "any")} label="Match all" />
          </div>
          {moreOpen && hidden > 0 && (
            <div className="flex flex-col gap-2" data-testid="more-tags">
              <SearchInput value={tagText} onValueChange={setTagText} aria-label="Find a tag" placeholder="Find a tag" className="max-w-xs" />
              {more.length > 0 ? (
                <ToggleGroup
                  type="multiple"
                  aria-label="More tags"
                  appearance="separate"
                  variant="outline"
                  intent="neutral"
                  size="sm"
                  className="flex-wrap"
                  value={tags.filter((slug) => within(more).has(slug))}
                  onValueChange={changeIn(more)}
                  options={more.map(tagOption)}
                />
              ) : (
                <p className="text-sm text-fg-subtle">No tag has that in its name.</p>
              )}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <SearchInput
          value={foodText}
          onValueChange={setFoodText}
          aria-label="Filter by food"
          placeholder="Filter by food"
          className="max-w-xs"
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
      <Switch checked={favourite} onCheckedChange={onFavouriteChange} label="Favourites only" />
    </div>
  );
}
