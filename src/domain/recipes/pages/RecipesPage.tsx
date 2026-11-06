import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Muted } from "@sixthshift/design-system/muted";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { Toggle } from "@sixthshift/design-system/toggle";
import { cn } from "@sixthshift/design-system/utils";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Page, PageHeader } from "../../../components/Page";
import { DiceIcon } from "../../../components/ui/icons";
import { arrayParam, newSeed, pickRandom } from "../../../lib/lists";
import { useViewMode } from "../../../lib/prefs";
import { SEARCH_DEBOUNCE_MS, searchParam } from "../../../lib/search";
import { useLayout } from "../../../lib/useLayout";
import { KindToggle } from "../components/KindToggle";
import { ActiveFilters, activeFilterCount } from "../components/library/ActiveFilters";
import { FilterBar, type FilterBarProps } from "../components/library/FilterBar";
import { FiltersSheet } from "../components/library/FiltersSheet";
import { CARD_MIN_WIDTH, RecipeCard } from "../components/library/RecipeCard";
import { ShelfToggle } from "../components/library/ShelfToggle";
import { SortMenu } from "../components/library/SortMenu";
import { tagsByUse } from "../components/library/tagUse";
import { ViewModeToggle } from "../components/library/ViewModeToggle";
import { resolveSort, type SortDir, type SortKey, selectedTags } from "../recipe";

const route = getRouteApi("/recipes/");

/** Cards whose image is fetched eagerly: a phone shows the first and the top of the second, a wide screen the first row. */
const PRIORITY_CARDS = 2;

export function RecipesPage() {
  const { recipes, tags, foods } = route.useLoaderData();
  const { q = "", tag, tags: tagsParam, match = "any", foods: foodsParam = [], favourite = false, shelf, sort: sortParam, dir: dirParam } = route.useSearch();
  const navigate = route.useNavigate();
  const selected = selectedTags(tag, tagsParam);
  const filtered = Boolean(q || selected.length > 0 || foodsParam.length > 0 || favourite || shelf);
  const [viewMode] = useViewMode();
  const desktop = useLayout() === "desktop";
  const { key: sort, dir } = resolveSort(sortParam, dirParam);

  const onSortChange = (nextSort: SortKey, nextDir: SortDir) => {
    void navigate({
      search: (prev) => ({ ...prev, sort: nextSort, dir: nextDir, seed: nextSort === "random" ? newSeed() : undefined }),
    });
  };

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
      {/* The chrome above the results, held close on a phone so the first card is above the fold. */}
      <div className="flex flex-col gap-3 desktop:gap-6">
        <search>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void navigate({ search: (prev) => ({ ...prev, q: searchParam(query) }) });
            }}
          >
            <SearchInput value={query} onValueChange={setQuery} placeholder="Search recipes" aria-label="Search recipes" name="q" />
          </form>
        </search>
        <div className="flex flex-wrap items-center gap-2">
          <ShelfToggle shelf={shelf} onChange={(next) => void navigate({ search: (prev) => ({ ...prev, shelf: next }) })} />
          {/* Marking the library one recipe page at a time is the slow way in; this puts the toggle under every card (decisions.md row 195). */}
          <Toggle variant="outline" size="sm" pressed={marking} onPressedChange={setMarking}>
            Mark Rotation &amp; Weekend
          </Toggle>
        </div>
        {/* Inline on a desktop; on a phone the same controls open in a sheet from the toolbar, and what is set shows as chips. */}
        {desktop ? <FilterBar {...filterBar} /> : <ActiveFilters {...filterBar} onClearAll={onClearFilters} />}
        {/* One line at 390px: no label here may wrap. Kept while a filter empties the list, so the sheet that set it can still be opened. */}
        {(recipes.length > 0 || filtered) && (
          <div className="flex items-center justify-between gap-2">
            <Muted as="p" className="whitespace-nowrap">
              {recipes.length === 1 ? "1 recipe" : `${recipes.length} recipes`}
            </Muted>
            <div className="flex items-center gap-2">
              {!desktop && (
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
              )}
              <SortMenu sort={sort} dir={dir} onChange={onSortChange} onRandom={recipes.length > 0 ? onDice : undefined} />
              {desktop && (
                <Button iconOnly variant="outline" intent="neutral" aria-label="Open a random recipe" onClick={onDice} disabled={recipes.length === 0}>
                  <DiceIcon />
                </Button>
              )}
              <ViewModeToggle />
            </div>
          </div>
        )}
      </div>
      <EmptyBoundary isEmpty={recipes.length === 0} fallback={<EmptyState filtered={filtered} />}>
        <ul
          className={viewMode === "list" ? "flex flex-col gap-3" : "grid gap-4"}
          style={viewMode === "list" ? undefined : { gridTemplateColumns: `repeat(auto-fill, minmax(min(${CARD_MIN_WIDTH}, 100%), 1fr))` }}
        >
          {recipes.map((recipe, index) => (
            <li key={recipe.id}>
              <RecipeCard recipe={{ ...recipe, tags: tagsByUse(recipe.tags, tags) }} mode={viewMode} priority={index < PRIORITY_CARDS} />
              {marking && (
                <div className="mt-2">
                  <KindToggle id={recipe.id} kind={recipe.kind} label={`How you cook ${recipe.name}`} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </EmptyBoundary>
      {sheetOpen && <FiltersSheet {...filterBar} count={recipes.length} onClose={() => setSheetOpen(false)} />}
    </Page>
  );
}

/** What the list shows when there is nothing to list: a search or filters that matched nothing, or no recipes yet. */
function EmptyState({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <div className="flex flex-col items-start gap-3 py-8">
        <Muted as="p">No recipes match that search.</Muted>
        <Button asChild variant="outline" intent="neutral">
          <Link to="/recipes" search={{}}>
            Clear filters
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <Muted as="p">No recipes yet.</Muted>
      <Button asChild intent="brand">
        <Link to="/recipes/new">Add your first recipe</Link>
      </Button>
    </div>
  );
}
