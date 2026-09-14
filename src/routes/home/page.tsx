// Recipe list. Search params `q` (name substring), `tag` (legacy single tag
// slug, still used by the recipe view's tag chip links), `tags`/`match`
// (M12.3 tag chips with an any/all switch), `foods` (food ids), `favourite`
// and `sort`/`dir`/`seed` (M12.4) feed the loader through loaderDeps, so
// changing any of them re-runs it. The search box, filter bar and sort menu
// only ever navigate; the loader is the one read path.
import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FilterBar } from "./components/FilterBar";
import { CARD_MIN_WIDTH, RecipeCard } from "../../components/recipe/RecipeCard";
import { SortMenu } from "./components/SortMenu";
import { ViewModeToggle } from "./components/ViewModeToggle";
import { arrayParam, selectedTags } from "../../domain/list/recipeFilters";
import { newSeed, pickRandom, resolveSort, type SortDir, type SortKey } from "../../domain/list/sort";
import { useViewMode } from "../../lib/prefs";
import { Route } from "./route";
import { SEARCH_DEBOUNCE_MS, searchParam } from "../../domain/list/search";

export function RecipesPage() {
  const { recipes, tags, foods } = Route.useLoaderData();
  const {
    q = "",
    tag,
    tags: tagsParam,
    match = "any",
    foods: foodsParam = [],
    favourite = false,
    sort: sortParam,
    dir: dirParam,
  } = Route.useSearch();
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
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <Heading as="h1">Recipes</Heading>
        <Button asChild variant="solid" intent="brand" size="sm">
          <Link to="/recipes/new">New recipe</Link>
        </Button>
      </div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void navigate({ search: (prev) => ({ ...prev, q: searchParam(query) }) });
        }}
      >
        <SearchInput value={query} onChange={setQuery} placeholder="Search recipes" aria-label="Search recipes" name="q" />
      </form>
      <FilterBar
        allTags={tags}
        allFoods={foods}
        tags={selected}
        match={match}
        foods={foodsParam}
        favourite={favourite}
        onTagsChange={(next) => void navigate({ search: (prev) => ({ ...prev, tag: undefined, tags: arrayParam(next) }) })}
        onMatchChange={(next) => void navigate({ search: (prev) => ({ ...prev, match: next === "any" ? undefined : next }) })}
        onFoodsChange={(next) => void navigate({ search: (prev) => ({ ...prev, foods: arrayParam(next) }) })}
        onFavouriteChange={(next) => void navigate({ search: (prev) => ({ ...prev, favourite: next ? true : undefined }) })}
      />
      <EmptyBoundary isEmpty={recipes.length === 0} fallback={<EmptyState filtered={filtered} />}>
        <div className="flex items-center justify-between gap-2">
          <Muted as="p">{recipes.length === 1 ? "1 recipe" : `${recipes.length} recipes`}</Muted>
          <div className="flex items-center gap-2">
            <SortMenu sort={sort} dir={dir} onChange={onSortChange} />
            <Button iconOnly variant="outline" intent="neutral" aria-label="Open a random recipe" onClick={onDice} disabled={recipes.length === 0}>
              <DiceIcon />
            </Button>
            <ViewModeToggle />
          </div>
        </div>
        <ul
          className={viewMode === "list" ? "flex max-w-5xl flex-col gap-3" : "grid gap-4"}
          style={
            viewMode === "list"
              ? undefined
              : { gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_MIN_WIDTH}, 1fr))` }
          }
        >
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <RecipeCard recipe={recipe} mode={viewMode} />
            </li>
          ))}
        </ul>
      </EmptyBoundary>
    </div>
  );
}

/** A six-sided die, for the "open a random recipe" button. */
function DiceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

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
