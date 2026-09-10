// Edit a recipe. The editor needs the document plus the unit and tag lists for
// its pickers; the three reads run in parallel. The form is keyed by recipe id
// so navigating between two recipes' edit pages resets the draft.
//
// Delete lives here too, below the form (Mealie keeps it in the recipe's
// action menu; this is the closest fit). It confirms, deletes, then lands on
// the list, saying so with a toast.
import { Button } from "@sixthshift/design-system/button";
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { draftFromRecipe, RecipeForm } from "../../../components/RecipeForm";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import type { Recipe, Tag, Unit } from "../../../domain/recipe";
import { useMutate } from "../../../lib/mutate";
import { notify, notifyError } from "../../../lib/notify";
import { deleteRecipe, getRecipe } from "../../../server/recipes";
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
      <DeleteRecipe key={`delete-${recipe.id}`} id={recipe.id} name={recipe.name} />
    </div>
  );
}

/**
 * The Delete button and its confirm. On confirm the recipe is removed through
 * `useMutate` (so the list's loader is stale-marked before we land on it) and
 * the page navigates to `/`. Both outcomes are reported by `notify()`; a failed
 * delete keeps the dialog open and nothing has changed.
 */
export function DeleteRecipe({ id, name }: { id: string; name: string }) {
  const navigate = useNavigate();
  const mutate = useMutate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    try {
      await mutate(() => deleteRecipe({ data: { id } }));
      notify({ intent: "success", title: `${name} deleted` });
      await navigate({ to: "/" });
    } catch (error) {
      notifyError("Could not delete recipe", error);
      setDeleting(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 border-t border-border-normal pt-6" aria-label="Delete recipe">
      <SectionTitle as="h2">Delete recipe</SectionTitle>
      <Muted as="p" className="text-sm">
        Takes the recipe out of your collection. This cannot be undone.
      </Muted>
      <div>
        <Button type="button" variant="outline" intent="danger" onClick={() => setConfirming(true)}>
          Delete recipe
        </Button>
      </div>
      {confirming && (
        <ConfirmDialog
          title={`Delete ${name}?`}
          confirmLabel="Delete"
          busy={deleting}
          busyLabel="Deleting…"
          aria-label="Delete recipe"
          onCancel={() => {
            if (!deleting) setConfirming(false);
          }}
          onConfirm={() => void confirm()}
        >
          <p>It goes from the list for good. This cannot be undone.</p>
        </ConfirmDialog>
      )}
    </section>
  );
}
