// Edit a recipe. The editor needs the document plus the unit and tag lists for
// its pickers; the three reads run in parallel.
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { createFileRoute } from "@tanstack/react-router";
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
    <div className="flex flex-col gap-4 p-6">
      <Heading as="h1">Edit recipe</Heading>
      <Muted as="p">{recipe.name}</Muted>
      <Muted as="p">
        {units.length} units, {tags.length} tags
      </Muted>
    </div>
  );
}
