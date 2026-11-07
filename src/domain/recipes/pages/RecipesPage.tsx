import { getRouteApi } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { arrayParam, newSeed, pickRandom } from "../../../lib/lists";
import { useLayout } from "../../../lib/useLayout";
import { facetFilterCount, facetSearch, facetsFromSearch, noFacetSearch } from "../components/facets/facetSearch";
import { activeFilterCount } from "../components/library/ActiveFilters";
import { DesktopLibrary } from "../components/library/desktop/DesktopLibrary";
import { FiltersColumn } from "../components/library/desktop/FiltersColumn";
import type { FilterBarProps } from "../components/library/FilterBar";
import { PhoneLibrary } from "../components/library/mobile/PhoneLibrary";
import { tagsByUse } from "../components/library/tagUse";
import { useSearchText } from "../components/library/useSearchText";
import { resolveSort, type SortDir, type SortKey, selectedTags } from "../recipe";

const route = getRouteApi("/recipes/");

/**
 * The library. On a phone two columns of photos under the collections, the
 * search at the foot of the screen and the filters in a sheet (PhoneLibrary,
 * decisions.md row 208); on a desktop three panes, the filters as a column, a
 * wall of photos and the side panel (DesktopLibrary, row 207). Both read and
 * write the same search params.
 */
export function RecipesPage() {
  const { recipes: found, tags, foods, shelves, facetCounts } = route.useLoaderData();
  const search = route.useSearch();
  const facets = facetsFromSearch(search);
  const { q = "", tag, tags: tagsParam, match = "any", foods: foodsParam = [], favourite = false, shelf, sort: sortParam, dir: dirParam, panel } = search;
  const navigate = route.useNavigate();
  const selected = selectedTags(tag, tagsParam);
  const filtered = Boolean(q || selected.length > 0 || foodsParam.length > 0 || favourite || shelf || facetFilterCount(facets) > 0);
  const desktop = useLayout() === "desktop";
  const { key: sort, dir } = resolveSort(sortParam, dirParam);
  // Each card's tags, most used first, so its few are the household's main shelves.
  const recipes = useMemo(() => found.map((recipe) => ({ ...recipe, tags: tagsByUse(recipe.tags, tags) })), [found, tags]);

  const onSortChange = (nextSort: SortKey, nextDir: SortDir) => {
    void navigate({
      search: (prev) => ({ ...prev, sort: nextSort, dir: nextDir, seed: nextSort === "random" ? newSeed() : undefined }),
    });
  };
  const onShelfChange = (next: typeof shelf) => void navigate({ search: (prev) => ({ ...prev, shelf: next }) });

  const filterBar: FilterBarProps = {
    allTags: tags,
    allFoods: foods,
    tags: selected,
    match,
    foods: foodsParam,
    favourite,
    facets,
    facetCounts,
    onFacetsChange: (next) => void navigate({ search: (prev) => ({ ...prev, ...facetSearch(next) }) }),
    onTagsChange: (next) => void navigate({ search: (prev) => ({ ...prev, tag: undefined, tags: arrayParam(next) }) }),
    onMatchChange: (next) => void navigate({ search: (prev) => ({ ...prev, match: next === "any" ? undefined : next }) }),
    onFoodsChange: (next) => void navigate({ search: (prev) => ({ ...prev, foods: arrayParam(next) }) }),
    onFavouriteChange: (next) => void navigate({ search: (prev) => ({ ...prev, favourite: next ? true : undefined }) }),
  };
  const onClearFilters = () =>
    void navigate({
      search: (prev) => ({ ...prev, ...noFacetSearch(), tag: undefined, tags: undefined, foods: undefined, favourite: undefined, shelf: undefined }),
    });
  const filterCount = activeFilterCount(selected, foodsParam, favourite, facets);
  const [marking, setMarking] = useState(false);

  const onDice = () => {
    const pick = pickRandom(recipes);
    if (pick) void navigate({ to: "/recipes/$slug", params: { slug: pick.slug } });
  };

  // Local text so typing is instant; the address follows after a pause or on Enter.
  const { query, setQuery, submit: submitQuery } = useSearchText(q);

  if (desktop) {
    return (
      <DesktopLibrary
        recipes={recipes}
        open={panel?.slug}
        filtered={filtered}
        marking={marking}
        onMarkingChange={setMarking}
        onDice={onDice}
        filters={
          <FiltersColumn
            {...filterBar}
            query={query}
            onQueryChange={setQuery}
            onQuerySubmit={submitQuery}
            shelf={shelf}
            shelves={shelves}
            onShelfChange={onShelfChange}
            sort={sort}
            dir={dir}
            onSortChange={onSortChange}
            // The shelf counts as a filter here: the column's Clear puts it back to Everything too.
            filterCount={filterCount + (shelf === undefined ? 0 : 1)}
            onClearFilters={onClearFilters}
          />
        }
      />
    );
  }

  return (
    <PhoneLibrary
      recipes={recipes}
      total={shelves.all}
      filtered={filtered}
      filters={filterBar}
      // Favourites has its own chip on a phone, so the button counts what only the sheet shows.
      filterCount={activeFilterCount(selected, foodsParam, false, facets)}
      onClearFilters={onClearFilters}
      shelf={shelf}
      onShelfChange={onShelfChange}
      query={query}
      onQueryChange={setQuery}
      onQuerySubmit={submitQuery}
      sort={sort}
      dir={dir}
      onSortChange={onSortChange}
      onDice={onDice}
      marking={marking}
      onMarkingChange={setMarking}
    />
  );
}
