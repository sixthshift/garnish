import { getRouteApi } from "@tanstack/react-router";
import { Page } from "../../../components/Page";
import { useLayout } from "../../../lib/useLayout";
import { RecipeForm } from "../components/editor/RecipeForm";
import { draftFromRecipe } from "../draft";

const route = getRouteApi("/recipes/$slug/edit");

export function EditRecipePage() {
  const { recipe, units, tags } = route.useLoaderData();
  const { servings } = route.useSearch();
  const form = (
    <RecipeForm key={recipe.id} initial={draftFromRecipe(recipe)} units={units} tags={tags} existing={{ id: recipe.id, slug: recipe.slug, servings }} />
  );
  // The editor is the recipe page's shape (decisions.md row 211): a desktop's is the page's three columns, a screen tall and edge
  // to edge as the page is; a phone's is the phone page's one column. The toolbar names the recipe, so no title above it.
  if (useLayout() === "desktop") return form;
  return <Page width="focus">{form}</Page>;
}
