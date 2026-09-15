import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog";
import { Menu } from "../../../../components/ui/Menu";
import { dayLabel } from "../../../../domain/plan";
import { ingredientsText, type Recipe, recipeUrl, toCooklang } from "../../../../domain/recipe";
import { writeClipboard } from "../../../../lib/clipboard";
import { useMutate } from "../../../../lib/mutate";
import { notify, notifyError } from "../../../../lib/notify";
import { foodForRecipe } from "../../../../server/fns/foods";
import { addPlanEntry } from "../../../../server/fns/plan";
import { deleteRecipe, duplicateRecipe } from "../../../../server/fns/recipes";
import { PlanPopover, planEntryFor } from "./PlanPopover";
import { RestyleSheet } from "./RestyleSheet";

export type RecipeActionsProps = {
  recipe: Recipe;
  /** Whether a model is configured. Without one, Restyle steps is not offered. */
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
