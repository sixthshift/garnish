// Edit a recipe. The editor needs the document plus the unit and tag lists for
// its pickers; the three reads run in parallel. The form is keyed by recipe id
// so navigating between two recipes' edit pages resets the draft.
import { Heading } from "@sixthshift/design-system/heading";
import { createFileRoute } from "@tanstack/react-router";
import { draftFromRecipe, RecipeForm } from "../../../components/RecipeForm";
import type { Recipe, Tag, Unit } from "../../../domain/recipe";
import { getRecipe } from "../../../server/recipes";
import { listTags } from "../../../server/tags";
import { listUnits } from "../../../server/units";

export type EditRecipeData = { recipe: Recipe; units: Unit[]; tags: Tag[] };

export const Route = createFileRoute("/recipes/$slug/edit")({
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
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <Heading as="h1">Edit recipe</Heading>
      <RecipeForm key={recipe.id} initial={draftFromRecipe(recipe)} units={units} tags={tags} existing={{ id: recipe.id, slug: recipe.slug }} />
    </div>
  );
}
