import { Button } from "@sixthshift/design-system/button";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import type { Recipe } from "../../domain/recipe";
import type { ShoppingAddition } from "../../domain/shopping";
import { notify, notifyError } from "../../lib/notify";
import { addedMessage, addToShoppingList } from "../../lib/shopping";
import { AddToShoppingSheet } from "./AddToShoppingSheet";

/** The list page. */
export const SHOPPING_PATH = "/shopping";

export type AddToShoppingButtonProps = {
  /** The recipe as the page is showing it: already scaled. */
  recipe: Recipe;
  size?: "sm" | "md";
};

/**
 * The button and its sheet: the recipe page's header action and cook mode's
 * finish card use the same one. The toast says how many lines the list gained
 * and offers a way to it.
 */
export function AddToShoppingButton({ recipe, size = "sm" }: AddToShoppingButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const add = async (additions: ShoppingAddition[]) => {
    setBusy(true);
    try {
      const added = await addToShoppingList(additions);
      setOpen(false);
      notify({
        intent: "success",
        title: addedMessage(added),
        // The Toaster is not the router's business, so the caller navigates:
        // this button is always rendered inside a route.
        action: { label: "View list", onSelect: () => void router.navigate({ to: SHOPPING_PATH }) },
      });
    } catch (error) {
      notifyError("Couldn't add to the shopping list", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" intent="neutral" size={size} data-testid="shopping-list-button" data-print="hide" onClick={() => setOpen(true)}>
        Add to shopping list
      </Button>
      <AddToShoppingSheet open={open} recipe={recipe} busy={busy} onCancel={() => setOpen(false)} onAdd={(additions) => void add(additions)} />
    </>
  );
}
