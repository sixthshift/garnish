import { Heading } from "@sixthshift/design-system/heading";
import { draftFromRecipe } from "../../../../domain/draft";
import { RecipeForm } from "../../components/RecipeForm";
import { Route } from "./route";

export function EditRecipePage() {
  const { recipe, units, tags } = Route.useLoaderData();
  const { servings } = Route.useSearch();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <Heading as="h1">Edit recipe</Heading>
      <RecipeForm key={recipe.id} initial={draftFromRecipe(recipe)} units={units} tags={tags} existing={{ id: recipe.id, slug: recipe.slug, servings }} />
    </div>
  );
}
