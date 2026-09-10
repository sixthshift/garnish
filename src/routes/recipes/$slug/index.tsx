// One recipe. `?servings=N` asks the server for the document scaled to N.
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { Recipe } from "../../../domain/recipe";
import { getRecipe } from "../../../server/recipes";

export const RecipeViewSearch = z.object({
  servings: z.number().positive().finite().optional(),
});

export const Route = createFileRoute("/recipes/$slug/")({
  validateSearch: RecipeViewSearch,
  loaderDeps: ({ search: { servings } }) => ({ servings }),
  loader: async ({ params, deps }): Promise<Recipe> => getRecipe({ data: { slug: params.slug, servings: deps.servings } }),
  component: RecipePage,
});

function RecipePage() {
  const recipe = Route.useLoaderData();
  return (
    <div className="flex flex-col gap-4 p-6">
      <Heading as="h1">{recipe.name}</Heading>
      <Muted as="p">
        {recipe.recipeServings > 0 ? `Serves ${recipe.recipeServings}` : "Servings not set"}
      </Muted>
    </div>
  );
}
