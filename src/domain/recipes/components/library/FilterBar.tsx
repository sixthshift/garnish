import { Button } from "@sixthshift/design-system/button";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { Switch } from "@sixthshift/design-system/switch";
import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { useState } from "react";
import { FACET_LAYERS, type Facets, facetLabel, LAYER_NAMES, type TagMatch } from "../../recipe";
import type { FoodSummary, TagUsage } from "../../reference";
import { countOf, type FacetCount, offeredValues } from "../facets/facetSearch";
import { FoodFilter } from "./FoodFilter";
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
  /** The facets asked for, and how many recipes carry each value over the whole library (decisions.md row 209). */
  facets: Facets;
  facetCounts: readonly FacetCount[];
  onFacetsChange: (facets: Facets) => void;
  onTagsChange: (tags: string[]) => void;
  onMatchChange: (match: TagMatch) => void;
  onFoodsChange: (foods: string[]) => void;
  onFavouriteChange: (favourite: boolean) => void;
};

/**
 * What a recipe is, a row of toggles a layer, each value with how many recipes
 * carry it: any of a layer's values, every layer asked. A layer no recipe has
 * said anything on is left out, so a library not yet marked shows none.
 */
function FacetRows({ facets, facetCounts, onFacetsChange }: Pick<FilterBarProps, "facets" | "facetCounts" | "onFacetsChange">) {
  return FACET_LAYERS.map((layer) => {
    const values = offeredValues(facetCounts, facets, layer);
    if (values.length === 0) return null;
    return (
      <section key={layer} className="flex flex-col gap-1.5" aria-labelledby={`filter-${layer}`}>
        <h3 id={`filter-${layer}`} className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          {LAYER_NAMES[layer]}
        </h3>
        <ToggleGroup
          type="multiple"
          aria-label={`Filter by ${LAYER_NAMES[layer].toLowerCase()}`}
          appearance="separate"
          variant="outline"
          intent="neutral"
          size="sm"
          className="flex-wrap"
          value={[...facets[layer]]}
          onValueChange={(next) => onFacetsChange({ ...facets, [layer]: values.filter((value) => next.includes(value)) })}
          options={values.map((value) => ({
            value,
            label: (
              <>
                {facetLabel(layer, value)}
                <span className="text-fg-subtle tabular-nums">{countOf(facetCounts, layer, value)}</span>
              </>
            ),
          }))}
        />
      </section>
    );
  });
}

export function FilterBar({
  allTags,
  allFoods,
  tags,
  match,
  foods,
  favourite,
  facets,
  facetCounts,
  onFacetsChange,
  onTagsChange,
  onMatchChange,
  onFoodsChange,
  onFavouriteChange,
}: FilterBarProps) {
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

  return (
    <div className="flex flex-col gap-3">
      <FacetRows facets={facets} facetCounts={facetCounts} onFacetsChange={onFacetsChange} />
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
      <FoodFilter allFoods={allFoods} foods={foods} onFoodsChange={onFoodsChange} inputClassName="max-w-xs" />
      <Switch checked={favourite} onCheckedChange={onFavouriteChange} label="Favourites only" />
    </div>
  );
}
