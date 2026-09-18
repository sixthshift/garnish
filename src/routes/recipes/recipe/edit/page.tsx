import { Page, PageHeader } from "../../../../components/shell/Page";
import { draftFromRecipe } from "../../../../domain/draft";
import { RecipeForm } from "../../components/RecipeForm";
import { Route } from "./route";

export function EditRecipePage() {
  const { recipe, units, tags } = Route.useLoaderData();
  const { servings } = Route.useSearch();
  return (
    <Page>
      <PageHeader title="Edit recipe" />
      <RecipeForm key={recipe.id} initial={draftFromRecipe(recipe)} units={units} tags={tags} existing={{ id: recipe.id, slug: recipe.slug, servings }} />
    </Page>
  );
}
