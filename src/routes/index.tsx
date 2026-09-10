// Recipe list. Search params `q` (name substring) and `tag` (tag slug) feed the
// loader through loaderDeps, so changing either re-runs it. The search box and
// tag filter only ever navigate; the loader is the one read path.
import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { RecipeCard } from "../components/RecipeCard";
import { ViewModeToggle } from "../components/ViewModeToggle";
import type { RecipeSummary, Tag } from "../domain/recipe";
import { useViewMode } from "../lib/prefs";
import { listRecipes } from "../server/recipes";
import { listTags } from "../server/tags";

export const RecipeListSearch = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
});

export type RecipeListData = { recipes: RecipeSummary[]; tags: Tag[] };

/** How long typing pauses before the URL (and so the loader) follows it. */
export const SEARCH_DEBOUNCE_MS = 300;

/** An empty or whitespace-only value drops the param from the URL. Pure. */
export function searchParam(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export const Route = createFileRoute("/")({
  validateSearch: RecipeListSearch,
  loaderDeps: ({ search: { q, tag } }) => ({ q, tag }),
  loader: async ({ deps }): Promise<RecipeListData> => {
    const [recipes, tags] = await Promise.all([listRecipes({ data: deps }), listTags({ data: {} })]);
    return { recipes, tags };
  },
  component: RecipesPage,
});

function RecipesPage() {
  const { recipes, tags } = Route.useLoaderData();
  const { q = "", tag = "" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const filtered = Boolean(q || tag);
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
      {tags.length > 0 && (
        <ToggleGroup
          type="single"
          aria-label="Filter by tag"
          appearance="separate"
          variant="outline"
          intent="neutral"
          size="sm"
          className="flex-wrap"
          value={tag}
          onValueChange={(value) => void navigate({ search: (prev) => ({ ...prev, tag: searchParam(value) }) })}
          options={[{ value: "", label: "All" }, ...tags.map((t) => ({ value: t.slug, label: t.name }))]}
        />
      )}
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
