import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Muted } from "@sixthshift/design-system/muted";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CARD_MIN_WIDTH, RecipeCard } from "../../components/recipe/RecipeCard";
import { Page, PageHeader } from "../../components/shell/Page";
import { DiceIcon } from "../../components/ui/icons";
import { resolveSort, type SortDir, type SortKey, selectedTags } from "../../domain/recipe";
import { arrayParam, newSeed, pickRandom } from "../../lib/lists";
import { useViewMode } from "../../lib/prefs";
import { SEARCH_DEBOUNCE_MS, searchParam } from "../../lib/search";
import { ActiveFilters, activeFilterCount } from "./components/ActiveFilters";
import { FilterBar, type FilterBarProps } from "./components/FilterBar";
import { FiltersSheet } from "./components/FiltersSheet";
import { SortMenu } from "./components/SortMenu";
import { ViewModeToggle } from "./components/ViewModeToggle";
import { Route } from "./route";

export function RecipesPage() {
  const { recipes, tags, foods } = Route.useLoaderData();
  const { q = "", tag, tags: tagsParam, match = "any", foods: foodsParam = [], favourite = false, sort: sortParam, dir: dirParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const selected = selectedTags(tag, tagsParam);
  const filtered = Boolean(q || selected.length > 0 || foodsParam.length > 0 || favourite);
  const [viewMode] = useViewMode();
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
  const onClearFilters = () => void navigate({ search: (prev) => ({ ...prev, tag: undefined, tags: undefined, foods: undefined, favourite: undefined }) });
  const filterCount = activeFilterCount(selected, foodsParam, favourite);
  const [sheetOpen, setSheetOpen] = useState(false);

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
      <div className="flex flex-col gap-3 md:gap-6">
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
        {/* Inline from `md:` up; on a phone the same controls open in a sheet from the toolbar, and what is set shows as chips. */}
        <div className="max-md:hidden">
          <FilterBar {...filterBar} />
        </div>
        <ActiveFilters {...filterBar} onClearAll={onClearFilters} className="md:hidden" />
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
                  "h-auto whitespace-nowrap px-3 py-1.5 md:hidden",
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
              <Button
                iconOnly
                variant="outline"
                intent="neutral"
                className="max-md:hidden"
                aria-label="Open a random recipe"
                onClick={onDice}
                disabled={recipes.length === 0}
              >
                <DiceIcon />
              </Button>
              <ViewModeToggle />
            </div>
          </div>
        )}
      </div>
      <EmptyBoundary isEmpty={recipes.length === 0} fallback={<EmptyState filtered={filtered} />}>
        <ul
          className={viewMode === "list" ? "flex flex-col gap-3" : "grid gap-4"}
          style={viewMode === "list" ? undefined : { gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_MIN_WIDTH}, 1fr))` }}
        >
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <RecipeCard recipe={recipe} mode={viewMode} />
            </li>
          ))}
        </ul>
      </EmptyBoundary>
      {sheetOpen && <FiltersSheet {...filterBar} count={recipes.length} onClose={() => setSheetOpen(false)} />}
    </Page>
  );
}

/** A six-sided die, for the "open a random recipe" button. */
function EmptyState({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <div className="flex flex-col items-start gap-3 py-8">
        <Muted as="p">No recipes match that search.</Muted>
        <Button asChild variant="outline" intent="neutral">
          <Link to="/" search={{}}>
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
