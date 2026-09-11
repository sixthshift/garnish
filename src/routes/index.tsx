// Recipe list. Search params `q` (name substring), `tag` (legacy single tag
// slug, still used by the recipe view's tag chip links), `tags`/`match`
// (M12.3 tag chips with an any/all switch), `foods` (food ids) and
// `favourite` feed the loader through loaderDeps, so changing any of them
// re-runs it. The search box and filter bar only ever navigate; the loader is
// the one read path.
import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { FilterBar } from "../components/FilterBar";
import { RecipeCard } from "../components/RecipeCard";
import { ViewModeToggle } from "../components/ViewModeToggle";
import type { RecipeSummary, Tag } from "../domain/recipe";
import { arrayParam, selectedTags } from "../domain/recipeFilters";
import { useViewMode } from "../lib/prefs";
import { listFoods } from "../server/foods";
import { listRecipes } from "../server/recipes";
import { listTags } from "../server/tags";

export const RecipeListSearch = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  tags: z.array(z.string()).optional(),
  match: z.enum(["any", "all"]).optional(),
  foods: z.array(z.string()).optional(),
  favourite: z.boolean().optional(),
});

/** Food rows as `listFoods` returns them: id and name are all the filter bar needs. */
type FoodRow = Awaited<ReturnType<typeof listFoods>>[number];

export type RecipeListData = { recipes: RecipeSummary[]; tags: Tag[]; foods: FoodRow[] };

/** How long typing pauses before the URL (and so the loader) follows it. */
export const SEARCH_DEBOUNCE_MS = 300;

/** An empty or whitespace-only value drops the param from the URL. Pure. */
export function searchParam(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export const Route = createFileRoute("/")({
  validateSearch: RecipeListSearch,
  loaderDeps: ({ search: { q, tag, tags, match, foods, favourite } }) => ({ q, tag, tags, match, foods, favourite }),
  loader: async ({ deps }): Promise<RecipeListData> => {
    const [recipes, tags, foods] = await Promise.all([
      listRecipes({ data: deps }),
      listTags({ data: {} }),
      listFoods({ data: {} }),
    ]);
    return { recipes, tags, foods };
  },
  component: RecipesPage,
});

function RecipesPage() {
  const { recipes, tags, foods } = Route.useLoaderData();
  const { q = "", tag, tags: tagsParam, match = "any", foods: foodsParam = [], favourite = false } = Route.useSearch();
  const navigate = Route.useNavigate();
  const selected = selectedTags(tag, tagsParam);
  const filtered = Boolean(q || selected.length > 0 || foodsParam.length > 0 || favourite);
  const [viewMode] = useViewMode();

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
      <Heading as="h1">Recipes</Heading>
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
          <ViewModeToggle />
        </div>
        <ul
          className={
            viewMode === "list" ? "flex flex-col gap-3" : "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
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
