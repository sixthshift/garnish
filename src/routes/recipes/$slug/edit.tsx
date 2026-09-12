// Edit a recipe. The editor needs the document plus the unit and tag lists for
// its pickers; the three reads run in parallel. The form is keyed by recipe id
// so navigating between two recipes' edit pages resets the draft.
//
// Delete is not here: it lives in the recipe view's action menu (M11.6,
// src/components/RecipeActions.tsx), which is where Mealie keeps it.
//
// `servings` (M25.5) carries no meaning for the editor itself — the form
// always edits the recipe's own stored servings — it only rides along so
// Cancel can hand the view page back the scale it was showing.
import { Heading } from "@sixthshift/design-system/heading";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { draftFromRecipe, RecipeForm } from "../../../components/RecipeForm";
import type { Recipe, Tag, Unit } from "../../../domain/recipe";
import { getRecipe } from "../../../server/recipes";
import { listTags } from "../../../server/tags";
import { listUnits } from "../../../server/units";

export const EditRecipeSearch = z.object({
  servings: z.number().positive().finite().optional(),
});

export type EditRecipeData = { recipe: Recipe; units: Unit[]; tags: Tag[] };

export const Route = createFileRoute("/recipes/$slug/edit")({
  validateSearch: EditRecipeSearch,
  loader: async ({ params }): Promise<EditRecipeData> => {
    const [recipe, units, tags] = await Promise.all([
      getRecipe({ data: { slug: params.slug } }),
      listUnits({ data: {} }),
      listTags({ data: {} }),
    ]);
    return { recipe, units, tags };
  },
  component: EditRecipePage,
});

function EditRecipePage() {
  const { recipe, units, tags } = Route.useLoaderData();
  const { servings } = Route.useSearch();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <Heading as="h1">Edit recipe</Heading>
      <RecipeForm
        key={recipe.id}
        initial={draftFromRecipe(recipe)}
        units={units}
        tags={tags}
        existing={{ id: recipe.id, slug: recipe.slug, servings }}
      />
    </div>
  );
}
