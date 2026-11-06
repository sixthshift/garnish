import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Muted } from "@sixthshift/design-system/muted";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { cn } from "@sixthshift/design-system/utils";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Page, PageHeader } from "../../../components/Page";
import { arrayParam, newSeed, pickRandom } from "../../../lib/lists";
import { useViewMode } from "../../../lib/prefs";
import { SEARCH_DEBOUNCE_MS, searchParam } from "../../../lib/search";
import { useLayout } from "../../../lib/useLayout";
import { ActiveFilters, activeFilterCount } from "../components/library/ActiveFilters";
import { CardList, LibraryEmpty, MarkToggle } from "../components/library/CardList";
import { DesktopLibrary } from "../components/library/desktop/DesktopLibrary";
import { FiltersColumn } from "../components/library/desktop/FiltersColumn";
import type { FilterBarProps } from "../components/library/FilterBar";
import { FiltersSheet } from "../components/library/FiltersSheet";
import { ShelfToggle } from "../components/library/ShelfToggle";
import { SortMenu } from "../components/library/SortMenu";
import { tagsByUse } from "../components/library/tagUse";
import { ViewModeToggle } from "../components/library/ViewModeToggle";
import { resolveSort, type SortDir, type SortKey, selectedTags } from "../recipe";

const route = getRouteApi("/recipes/");

/**
 * The library. On a phone the search, the shelves and a toolbar over the
 * cards, the finer filters in a sheet; on a desktop three panes, the filters
 * as a column, a wall of photos and the side panel (DesktopLibrary,
 * decisions.md row 207). Both read and write the same search params.
 */
export function RecipesPage() {
  const { recipes: found, tags, foods, shelves } = route.useLoaderData();
  const {
    q = "",
    tag,
    tags: tagsParam,
    match = "any",
    foods: foodsParam = [],
    favourite = false,
    shelf,
    sort: sortParam,
    dir: dirParam,
    panel,
  } = route.useSearch();
  const navigate = route.useNavigate();
  const selected = selectedTags(tag, tagsParam);
  const filtered = Boolean(q || selected.length > 0 || foodsParam.length > 0 || favourite || shelf);
  const [viewMode] = useViewMode();
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
    onTagsChange: (next) => void navigate({ search: (prev) => ({ ...prev, tag: undefined, tags: arrayParam(next) }) }),
    onMatchChange: (next) => void navigate({ search: (prev) => ({ ...prev, match: next === "any" ? undefined : next }) }),
    onFoodsChange: (next) => void navigate({ search: (prev) => ({ ...prev, foods: arrayParam(next) }) }),
    onFavouriteChange: (next) => void navigate({ search: (prev) => ({ ...prev, favourite: next ? true : undefined }) }),
  };
  const onClearFilters = () =>
    void navigate({ search: (prev) => ({ ...prev, tag: undefined, tags: undefined, foods: undefined, favourite: undefined, shelf: undefined }) });
  const filterCount = activeFilterCount(selected, foodsParam, favourite);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [marking, setMarking] = useState(false);

  const onDice = () => {
    const pick = pickRandom(recipes);
    if (pick) void navigate({ to: "/recipes/$slug", params: { slug: pick.slug } });
  };

  // Local text so typing is instant; the URL follows after a pause or on Enter.
  const [query, setQuery] = useState(q);
  useEffect(() => setQuery(q), [q]);
  useEffect(() => {
    if (searchParam(query) === searchParam(q)) return;
    const timer = setTimeout(() => void navigate({ search: (prev) => ({ ...prev, q: searchParam(query) }), replace: true }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, q, navigate]);
  const submitQuery = () => void navigate({ search: (prev) => ({ ...prev, q: searchParam(query) }) });

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
    <Page>
      <PageHeader
        title="Recipes"
        actions={
          <Button asChild variant="solid" intent="brand" size="sm">
            <Link to="/recipes/new">New recipe</Link>
          </Button>
        }
      />
      {/* The chrome above the results, held close so the first card is above the fold. */}
      <div className="flex flex-col gap-3">
        <search>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitQuery();
            }}
          >
            <SearchInput value={query} onValueChange={setQuery} placeholder="Search recipes" aria-label="Search recipes" name="q" />
          </form>
        </search>
        <div className="flex flex-wrap items-center gap-2">
          <ShelfToggle shelf={shelf} onChange={onShelfChange} />
          <MarkToggle marking={marking} onChange={setMarking} />
        </div>
        {/* The finer filters open in a sheet from the toolbar, and what is set shows as chips. */}
        <ActiveFilters {...filterBar} onClearAll={onClearFilters} />
        {/* One line at 390px: no label here may wrap. Kept while a filter empties the list, so the sheet that set it can still be opened. */}
        {(recipes.length > 0 || filtered) && (
          <div className="flex items-center justify-between gap-2">
            <Muted as="p" className="whitespace-nowrap">
              {recipes.length === 1 ? "1 recipe" : `${recipes.length} recipes`}
            </Muted>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                intent="neutral"
                // The Sort trigger's box (Menu's TRIGGER_CLASS), so the two sit at one size. While a filter is set it takes
                // the view toggle's selected fill, never brand: the count carries the state, the fill only echoes it.
                className={cn(
                  "h-auto whitespace-nowrap px-3 py-1.5",
                  filterCount > 0 &&
                    "[--button-bg-hovered:var(--intent-tint-bg-pressed)] [--button-bg:var(--intent-tint-bg-pressed)] [--button-fg:var(--intent-tint-fg-pressed)]"
                )}
                aria-haspopup="dialog"
                aria-label={filterCount > 0 ? `Filters, ${filterCount} active` : "Filters"}
                onClick={() => setSheetOpen(true)}
              >
                {filterCount > 0 ? `Filters · ${filterCount}` : "Filters"}
              </Button>
              <SortMenu sort={sort} dir={dir} onChange={onSortChange} onRandom={recipes.length > 0 ? onDice : undefined} />
              <ViewModeToggle />
            </div>
          </div>
        )}
      </div>
      <EmptyBoundary isEmpty={recipes.length === 0} fallback={<LibraryEmpty filtered={filtered} />}>
        <CardList recipes={recipes} mode={viewMode} marking={marking} />
      </EmptyBoundary>
      {sheetOpen && <FiltersSheet {...filterBar} count={recipes.length} onClose={() => setSheetOpen(false)} />}
    </Page>
  );
}
