import { Button } from "@sixthshift/design-system/button";
import { toast } from "@sixthshift/design-system/overlay";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { SHOPPING_PATH } from "../../../components/shopping/AddToShoppingButton";
import { addedMessage } from "../../../lib/shopping";
import { toastError } from "../../../lib/toast";
import { addPlanWeekToShopping } from "../../../server/fns/plan";

/**
 * "Add this week to the shopping list": runs `addPlanWeekToShopping`
 * for `monday`'s week and toasts how many lines the list gained, with a way
 * to it — the same toast `AddToShoppingButton` raises for one recipe
 * (src/components/shopping/AddToShoppingSheet.tsx). Its own busy state, not the page's:
 * this is one self-contained write, not one of the entry writes the page
 * threads through `onAddText`/`onAddRecipe`/`onMove`/`onRemove`.
 */
export function AddWeekToShoppingButton({ monday }: { monday: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      const { added } = await addPlanWeekToShopping({ data: { monday } });
      toast({
        intent: "success",
        title: addedMessage(added),
        action: "View list",
        onAction: () => void router.navigate({ to: SHOPPING_PATH }),
      });
    } catch (error) {
      toastError("Couldn't add the week to the shopping list", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" intent="neutral" size="sm" disabled={busy} data-testid="plan-add-week" onClick={() => void add()}>
      {busy ? "Adding…" : "Add this week to the shopping list"}
    </Button>
  );
}
