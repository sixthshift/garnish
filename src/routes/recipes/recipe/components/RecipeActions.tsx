// The recipe page's action menu: everything you can do to the recipe you are
// looking at except Edit and Cook, which sit beside it as their own buttons
// in the header (M25.5) rather than living in here.
//
// Duplicate writes through `useMutate` and lands on the copy; the Copy items
// (link, ingredients, Cooklang) go through `src/lib/clipboard.ts` — the
// Cooklang one via `src/domain/recipe/cooklang.ts`'s `toCooklang` (M34.2), the same
// function `GET /api/recipes/:slug.cook` serves; Print asks the browser to
// print the page (the print rules live in src/styles.css); Delete confirms
// first, and is the one destructive item, kept at the bottom behind a separator.
// Delete moved here from the edit page (M11.6), which is where Mealie has it,
// and keeps the same `ConfirmDialog`.
//
// "Make this a food" (M32.3, decisions.md row 70) is the sub-recipe hook from
// the recipe's own side: it finds or creates a food of the recipe's name with
// `recipeId` set, so the next recipe that calls for it can pick it out of the
// ingredient editor's food list and get a link back here. Idempotent — running
// it twice lands on the same food — so it needs no confirmation.
//
// "Restyle steps" (M37.6) opens `RestyleSheet`, and is only offered when a
// model is configured: without one there is nothing to rewrite with, and the
// page's loader has already asked. The same flag and the page's `?restyle`
// search param open the sheet on arrival, which is how a URL import's Create
// lands straight on the offer — `onRestyleClose` is what clears the param
// again, so dismissing it is the one tap the task asks for.
//
// "Plan" (M33.4) opens `PlanPopover` (src/routes/recipes/recipe/components/PlanPopover.tsx): the
// next seven days and a servings stepper. It sits in its own `relative` box
// alongside the menu because the popover's trigger has to be an element that
// outlives the menu item that opens it — see that file's header for why.
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toCooklang, ingredientsText, recipeUrl, type Recipe } from "../../../../domain/recipe";
import { dayLabel } from "../../../../domain/plan";
import { writeClipboard } from "../../../../lib/clipboard";
import { useMutate } from "../../../../lib/mutate";
import { notify, notifyError } from "../../../../lib/notify";
import { foodForRecipe } from "../../../../server/fns/foods";
import { addPlanEntry } from "../../../../server/fns/plan";
import { deleteRecipe, duplicateRecipe } from "../../../../server/fns/recipes";
import { PlanPopover } from "./PlanPopover";
import { planEntryFor } from "./PlanPopover";
import { RestyleSheet } from "./RestyleSheet";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog";
import { Menu } from "../../../../components/ui/Menu";

export type RecipeActionsProps = {
  recipe: Recipe;
  /** Whether a model is configured (M37.6). Without one, Restyle steps is not offered. */
  aiAvailable?: boolean;
  /** Open the restyle sheet on mount: the page's `?restyle` param, after an import's Create. */
  restyleOpen?: boolean;
  /** Called when the restyle sheet closes, so the page can drop `?restyle`. */
  onRestyleClose?: () => void;
};

export function RecipeActions({ recipe, aiAvailable = false, restyleOpen = false, onRestyleClose }: RecipeActionsProps) {
  const navigate = useNavigate();
  const mutate = useMutate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [planning, setPlanning] = useState(false);
  // Seeded from the prop rather than driven by it: `?restyle` only ever
  // arrives on the first render, and the sheet owns its life after that.
  const [restyling, setRestyling] = useState(restyleOpen);

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

  const makeFood = async () => {
    try {
      const food = await mutate(() => foodForRecipe({ data: { recipeId: recipe.id } }));
      notify({ intent: "success", title: `${food.name} is now a food`, message: "Add it to another recipe's ingredients to link back here." });
    } catch (error) {
      notifyError("Could not make this a food", error);
    }
  };

  const planTo = async (date: string, servings: number) => {
    try {
      await mutate(() => addPlanEntry({ data: planEntryFor(recipe, date, servings) }));
      notify({ intent: "success", title: `Added to ${dayLabel(date)}` });
      setPlanning(false);
    } catch (error) {
      notifyError("Could not plan this recipe", error);
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
      <div className="relative inline-block">
        <Menu label="Recipe actions" iconOnly>
          <Menu.Item onSelect={() => void duplicate()}>Duplicate</Menu.Item>
          <Menu.Item onSelect={() => void makeFood()}>Make this a food</Menu.Item>
          <Menu.Item onSelect={() => setPlanning(true)}>Plan</Menu.Item>
          {aiAvailable && <Menu.Item onSelect={() => setRestyling(true)}>Restyle steps</Menu.Item>}
          <Menu.Item onSelect={copyLink}>Copy link</Menu.Item>
          <Menu.Item onSelect={() => void copy(ingredientsText(recipe), "Ingredients")}>Copy ingredients</Menu.Item>
          <Menu.Item onSelect={() => void copy(toCooklang(recipe), "Cooklang")}>Copy as Cooklang</Menu.Item>
          <Menu.Item onSelect={() => (globalThis as { print?: () => void }).print?.()}>Print</Menu.Item>
          <Menu.Separator />
          <Menu.Item intent="danger" onSelect={() => setConfirming(true)}>
            Delete
          </Menu.Item>
        </Menu>
        <RestyleSheet
          open={restyling}
          recipe={recipe}
          onClose={() => {
            setRestyling(false);
            onRestyleClose?.();
          }}
        />
        <PlanPopover recipe={recipe} open={planning} onOpenChange={setPlanning} onChoose={(date, servings) => void planTo(date, servings)} />
      </div>
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
