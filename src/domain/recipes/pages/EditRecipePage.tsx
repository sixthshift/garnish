import { getRouteApi } from "@tanstack/react-router";
import { Page, PageHeader } from "../../../components/Page";
import { useLayout } from "../../../lib/useLayout";
import { RecipeForm } from "../components/editor/RecipeForm";
import { draftFromRecipe } from "../draft";

const route = getRouteApi("/recipes/$slug/edit");

export function EditRecipePage() {
  const { recipe, units, tags } = route.useLoaderData();
  const { servings } = route.useSearch();
  // A desktop lays the editor out beside its preview, across the width (decisions.md row 207); a phone's is one column, read top to bottom.
  const width = useLayout() === "desktop" ? "full" : "focus";
  return (
    <Page width={width}>
      <PageHeader title="Edit recipe" />
      <RecipeForm key={recipe.id} initial={draftFromRecipe(recipe)} units={units} tags={tags} existing={{ id: recipe.id, slug: recipe.slug, servings }} />
    </Page>
  );
}
