// Recipe list. Search params `q` (name substring) and `tag` (tag slug) feed the
// loader through loaderDeps, so changing either re-runs it.
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { RecipeSummary } from "../domain/recipe";
import { listRecipes } from "../server/recipes";

export const RecipeListSearch = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: RecipeListSearch,
  loaderDeps: ({ search: { q, tag } }) => ({ q, tag }),
  loader: async ({ deps }): Promise<RecipeSummary[]> => listRecipes({ data: deps }),
  component: RecipesPage,
});

function RecipesPage() {
  const recipes = Route.useLoaderData();
  return (
    <div className="flex flex-col gap-4 p-6">
      <Heading as="h1">Recipes</Heading>
      {recipes.length === 0 ? (
        <Muted as="p">No recipes yet.</Muted>
      ) : (
        <>
          <Muted as="p">{recipes.length === 1 ? "1 recipe" : `${recipes.length} recipes`}</Muted>
          <ul className="flex flex-col gap-1">
            {recipes.map((recipe) => (
              <li key={recipe.id}>{recipe.name}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
