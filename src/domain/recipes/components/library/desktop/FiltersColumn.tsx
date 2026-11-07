import { Button } from "@sixthshift/design-system/button";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { Switch } from "@sixthshift/design-system/switch";
import { Toggle } from "@sixthshift/design-system/toggle";
import { type ReactNode, useState } from "react";
import { FACET_LAYERS, facetLabel, LAYER_NAMES, type ShelfCounts, type SortDir, type SortKey } from "../../../recipe";
import type { TagUsage } from "../../../reference";
import { countOf, offeredValues, toggleFacet } from "../../facets/facetSearch";
import type { FilterBarProps } from "../FilterBar";
import { FoodFilter } from "../FoodFilter";
import { type Shelf, shelfFromValue, shelfOptions } from "../ShelfToggle";
import { SortMenu } from "../SortMenu";
import { tagShelves } from "../tagUse";

export type FiltersColumnProps = FilterBarProps & {
  /** The search box's text, ahead of the address while typing. */
  query: string;
  onQueryChange: (query: string) => void;
  /** Enter in the search box: the address takes the text now rather than after the pause. */
  onQuerySubmit: () => void;
  shelf: Shelf | undefined;
  shelves: ShelfCounts;
  onShelfChange: (shelf: Shelf | undefined) => void;
  sort: SortKey;
  dir: SortDir;
  onSortChange: (sort: SortKey, dir: SortDir) => void;
  /** How many filters are set; with any, the column offers to clear them. */
  filterCount: number;
  onClearFilters: () => void;
};

/** A facet's heading, the small capitals the design system's labels use. */
function FacetLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
      {children}
    </h2>
  );
}

/** One choice in a facet: its name, and how many recipes it holds, pressed while it is set. */
function FacetToggle({
  pressed,
  onPressedChange,
  label,
  count,
}: {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  label: string;
  count?: number;
}) {
  return (
    <Toggle
      variant="ghost"
      intent="neutral"
      size="sm"
      pressed={pressed}
      onPressedChange={onPressedChange}
      className="w-full justify-between text-sm font-normal data-[state=on]:font-semibold"
    >
      <span className="truncate">{label}</span>
      {count !== undefined && <span className="text-xs font-normal text-fg-subtle tabular-nums">{count}</span>}
    </Toggle>
  );
}

/**
 * A desktop's library filters as a column down the left (decisions.md row
 * 207): the search, the shelves, the tags as a list with their counts, the
 * foods, favourites and the order, each set through the address as the phone's
 * sheet sets them. It scrolls on its own, so the wall beside it keeps its
 * place. The shelf counts are over the whole library; the tag counts are each
 * tag's own (TagUsage). Under the shelves, what a recipe is (decisions.md row
 * 209), a list a layer of the values some recipe has, with their counts over
 * the whole library: any of a layer's values, every layer asked. A layer no
 * recipe has a value on yet is still named, and says so.
 */
export function FiltersColumn(props: FiltersColumnProps) {
  const { allTags, allFoods, tags, match, foods, favourite, onTagsChange, onMatchChange, onFoodsChange, onFavouriteChange } = props;
  const [moreOpen, setMoreOpen] = useState(false);
  const [tagText, setTagText] = useState("");
  const { top, more } = tagShelves(allTags, tags, tagText);
  const hidden = allTags.length - top.length;
  const toggleTag = (tag: TagUsage) => (on: boolean) => onTagsChange(on ? [...tags, tag.slug] : tags.filter((slug) => slug !== tag.slug));
  const counts: Record<string, number> = { all: props.shelves.all, rotation: props.shelves.rotation, weekend: props.shelves.weekend, try: props.shelves.try };

  return (
    <aside
      aria-label="Filters"
      className="flex min-h-0 flex-col gap-5 overflow-y-auto border-r border-border-subtle bg-bg-normal px-4 py-5"
      data-testid="filters-column"
    >
      <search>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            props.onQuerySubmit();
          }}
        >
          <SearchInput value={props.query} onValueChange={props.onQueryChange} placeholder="Search recipes" aria-label="Search recipes" name="q" />
        </form>
      </search>

      <section aria-labelledby="facet-shelf" className="flex flex-col gap-0.5">
        <FacetLabel id="facet-shelf">Collections</FacetLabel>
        {shelfOptions.map((option) => (
          <FacetToggle
            key={option.value}
            label={option.label}
            count={counts[option.value]}
            pressed={(props.shelf ?? "all") === option.value}
            // Pressing the shelf that is set leaves it set: one is always chosen, Everything when none is.
            onPressedChange={() => props.onShelfChange(shelfFromValue(option.value))}
          />
        ))}
      </section>

      {FACET_LAYERS.map((layer) => {
        const values = offeredValues(props.facetCounts, props.facets, layer);
        const chosen: readonly string[] = props.facets[layer];
        return (
          <section key={layer} aria-labelledby={`facet-${layer}`} className="flex flex-col gap-0.5">
            <FacetLabel id={`facet-${layer}`}>{LAYER_NAMES[layer]}</FacetLabel>
            {/* Named even before anything is marked, so the column says what can be filtered by. */}
            {values.length === 0 && (
              <p className="px-2 text-sm text-fg-subtle" data-empty-layer={layer}>
                None marked yet
              </p>
            )}
            {values.map((value) => (
              <FacetToggle
                key={value}
                label={facetLabel(layer, value)}
                count={countOf(props.facetCounts, layer, value)}
                pressed={chosen.includes(value)}
                onPressedChange={(on) => props.onFacetsChange(toggleFacet(props.facets, layer, value as never, on))}
              />
            ))}
          </section>
        );
      })}

      {allTags.length > 0 && (
        <section aria-labelledby="facet-tags" className="flex flex-col gap-0.5">
          <FacetLabel id="facet-tags">Tags</FacetLabel>
          {top.map((tag) => (
            <FacetToggle key={tag.id} label={tag.name} count={tag.recipes} pressed={tags.includes(tag.slug)} onPressedChange={toggleTag(tag)} />
          ))}
          {moreOpen && (
            <div className="flex flex-col gap-0.5 pt-1" data-testid="more-tags">
              <SearchInput value={tagText} onValueChange={setTagText} aria-label="Find a tag" placeholder="Find a tag" className="mb-1" />
              {more.map((tag) => (
                <FacetToggle key={tag.id} label={tag.name} count={tag.recipes} pressed={tags.includes(tag.slug)} onPressedChange={toggleTag(tag)} />
              ))}
              {more.length === 0 && <p className="px-2 text-sm text-fg-subtle">No tag has that in its name.</p>}
            </div>
          )}
          {hidden > 0 && (
            <Button
              type="button"
              variant="ghost"
              intent="neutral"
              size="sm"
              className="justify-start"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(!moreOpen)}
            >
              {moreOpen ? "Fewer tags" : `More tags (${hidden})`}
            </Button>
          )}
          <div className="px-2 pt-2">
            <Switch checked={match === "all"} onCheckedChange={(checked) => onMatchChange(checked ? "all" : "any")} label="Match all" />
          </div>
        </section>
      )}

      <section aria-labelledby="facet-food" className="flex flex-col gap-1">
        <FacetLabel id="facet-food">Made with</FacetLabel>
        <FoodFilter allFoods={allFoods} foods={foods} onFoodsChange={onFoodsChange} />
      </section>

      <div className="px-2">
        <Switch checked={favourite} onCheckedChange={onFavouriteChange} label="Favourites only" />
      </div>

      <section aria-labelledby="facet-sort" className="flex flex-col gap-1">
        <FacetLabel id="facet-sort">Order</FacetLabel>
        <SortMenu sort={props.sort} dir={props.dir} onChange={props.onSortChange} />
      </section>

      {props.filterCount > 0 && (
        <Button type="button" variant="outline" intent="neutral" size="sm" onClick={props.onClearFilters}>
          {`Clear filters (${props.filterCount})`}
        </Button>
      )}
    </aside>
  );
}
