import { Button } from "@sixthshift/design-system/button";
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { cn } from "@sixthshift/design-system/utils";
import { withoutId } from "../../../../lib/lists";
import { FACET_LAYERS, type Facets, facetLabel, LAYER_NAMES, noFacets } from "../../recipe";
import type { FoodSummary, Tag } from "../../reference";
import { facetFilterCount, toggleFacet } from "../facets/facetSearch";

export type ActiveFiltersProps = {
  allTags: readonly Tag[];
  allFoods: readonly FoodSummary[];
  tags: readonly string[];
  foods: readonly string[];
  favourite: boolean;
  /** The facets asked for (decisions.md row 209); none when left out. */
  facets?: Facets;
  onFacetsChange?: (facets: Facets) => void;
  onTagsChange: (tags: string[]) => void;
  onFoodsChange: (foods: string[]) => void;
  onFavouriteChange: (favourite: boolean) => void;
  /** Clear every tag, food and the favourites switch at once. */
  onClearAll: () => void;
  className?: string;
};

/**
 * How many filters are set: one per tag, one per food, one for favourites, one
 * per facet value. The
 * any/all switch qualifies the tags rather than filtering by itself, and the
 * search box shows its own text, so neither counts. Pure.
 */
export function activeFilterCount(tags: readonly string[], foods: readonly string[], favourite: boolean, facets: Facets = noFacets()): number {
  return tags.length + foods.length + (favourite ? 1 : 0) + facetFilterCount(facets);
}

/**
 * The filters in force as one row of removable chips, so on a phone, where the
 * controls sit in a sheet, what narrows the list is still on screen. Renders
 * nothing when nothing is set; "Clear all" from two up.
 */
export function ActiveFilters({
  allTags,
  allFoods,
  tags,
  foods,
  favourite,
  facets = noFacets(),
  onFacetsChange,
  onTagsChange,
  onFoodsChange,
  onFavouriteChange,
  onClearAll,
  className,
}: ActiveFiltersProps) {
  const count = activeFilterCount(tags, foods, favourite, facets);
  if (count === 0) return null;
  const tagName = new Map(allTags.map((tag) => [tag.slug, tag.name]));
  const foodName = new Map(allFoods.map((food) => [food.id, food.name]));

  return (
    <div className={cn("min-w-0", className)}>
      {/* One row however many are set: it scrolls sideways rather than pushing the results down. */}
      <ul className="flex items-center gap-1 overflow-x-auto [&>li]:shrink-0" aria-label="Active filters">
        {FACET_LAYERS.flatMap((layer) =>
          facets[layer].map((value) => (
            <li key={`${layer}-${value}`} title={LAYER_NAMES[layer]}>
              <TagChip tag={facetLabel(layer, value)} onRemove={() => onFacetsChange?.(toggleFacet(facets, layer, value as never, false))} />
            </li>
          ))
        )}
        {tags.map((slug) => (
          <li key={`tag-${slug}`}>
            <TagChip tag={tagName.get(slug) ?? slug} onRemove={() => onTagsChange(withoutId(tags, slug))} />
          </li>
        ))}
        {foods.map((id) => (
          <li key={`food-${id}`}>
            <TagChip tag={foodName.get(id) ?? id} onRemove={() => onFoodsChange(withoutId(foods, id))} />
          </li>
        ))}
        {favourite && (
          <li>
            <TagChip tag="Favourites" onRemove={() => onFavouriteChange(false)} />
          </li>
        )}
        {count >= 2 && (
          <li>
            <Button type="button" variant="ghost" intent="neutral" size="xs" onClick={onClearAll}>
              Clear all
            </Button>
          </li>
        )}
      </ul>
    </div>
  );
}
