import { getRouteApi } from "@tanstack/react-router";
import { Page, PageHeader } from "../../../components/Page";
import { RecipeForm } from "../components/editor/RecipeForm";
import { draftFromRecipe } from "../draft";

const route = getRouteApi("/recipes/$slug/edit");

export function EditRecipePage() {
  const { recipe, units, tags } = route.useLoaderData();
  const { servings } = route.useSearch();
  return (
    <Page>
      <PageHeader title="Edit recipe" />
      <RecipeForm key={recipe.id} initial={draftFromRecipe(recipe)} units={units} tags={tags} existing={{ id: recipe.id, slug: recipe.slug, servings }} />
    </Page>
  );
}
