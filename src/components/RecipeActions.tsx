// The recipe page's action menu: everything you can do to the recipe you are
// looking at except Edit and Cook, which sit beside it as their own buttons
// in the header (M25.5) rather than living in here.
//
// Duplicate writes through `useMutate` and lands on the copy; the two Copy
// items go through `src/lib/clipboard.ts`; Print asks the browser to print
// the page (the print rules live in src/styles.css); Delete confirms first,
// and is the one destructive item, kept at the bottom behind a separator.
// Delete moved here from the edit page (M11.6), which is where Mealie has it,
// and keeps the same `ConfirmDialog`.
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ingredientsText, recipeUrl } from "../domain/copy";
import type { Recipe } from "../domain/recipe";
import { writeClipboard } from "../lib/clipboard";
import { useMutate } from "../lib/mutate";
import { notify, notifyError } from "../lib/notify";
import { deleteRecipe, duplicateRecipe } from "../server/recipes";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Menu } from "./ui/Menu";

export type RecipeActionsProps = {
  recipe: Recipe;
};

export function RecipeActions({ recipe }: RecipeActionsProps) {
  const navigate = useNavigate();
  const mutate = useMutate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const copy = async (text: string, what: string) => {
    if (text.trim() === "") {
      notify({ intent: "warning", title: "Nothing to copy" });
      return;
    }
    if (await writeClipboard(text)) notify({ intent: "success", title: `${what} copied` });
    else notify({ intent: "danger", title: `Could not copy ${what.toLowerCase()}` });
  };

  const copyLink = () => {
    const origin = (globalThis as { location?: { origin?: string } }).location?.origin ?? "";
    void copy(recipeUrl(origin, recipe.slug), "Link");
  };

  const duplicate = async () => {
    try {
      const copyOfRecipe = await mutate(() => duplicateRecipe({ data: { id: recipe.id } }));
      notify({ intent: "success", title: `${copyOfRecipe.name} created` });
      await navigate({ to: "/recipes/$slug", params: { slug: copyOfRecipe.slug } });
    } catch (error) {
      notifyError("Could not duplicate recipe", error);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await mutate(() => deleteRecipe({ data: { id: recipe.id } }));
      notify({ intent: "success", title: `${recipe.name} deleted` });
      await navigate({ to: "/" });
    } catch (error) {
      notifyError("Could not delete recipe", error);
      setDeleting(false);
    }
  };

  return (
    <>
      <Menu label="Recipe actions" iconOnly>
        <Menu.Item onSelect={() => void duplicate()}>Duplicate</Menu.Item>
        <Menu.Item onSelect={copyLink}>Copy link</Menu.Item>
        <Menu.Item onSelect={() => void copy(ingredientsText(recipe), "Ingredients")}>Copy ingredients</Menu.Item>
        <Menu.Item onSelect={() => (globalThis as { print?: () => void }).print?.()}>Print</Menu.Item>
        <Menu.Separator />
        <Menu.Item intent="danger" onSelect={() => setConfirming(true)}>
          Delete
        </Menu.Item>
      </Menu>
      {confirming && (
        <ConfirmDialog
          title={`Delete ${recipe.name}?`}
          confirmLabel="Delete"
          busy={deleting}
          busyLabel="Deleting…"
          aria-label="Delete recipe"
          onCancel={() => {
            if (!deleting) setConfirming(false);
          }}
          onConfirm={() => void remove()}
        >
          <p>It goes from the list for good. This cannot be undone.</p>
        </ConfirmDialog>
      )}
    </>
  );
}
