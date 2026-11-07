import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { addPlanEntry, replacePlanEntry } from "../../../api/rpc/plan";
import { useMutate } from "../../../lib/mutate";
import { toastError } from "../../../lib/toast";
import { useLayout } from "../../../lib/useLayout";
import { searchPlanRecipes } from "../../plan/components/week/searchPlanRecipes";
import type { Meal } from "../../plan/plan";
import { HomeBento } from "../components/desktop/HomeBento";
import { PhoneHome, type PlanChoice } from "../components/mobile/PhoneHome";

const route = getRouteApi("/");

/** An add's input for `date`: a recipe keeps its name with its id, so the entry still reads if the recipe goes. */
function entryInput(date: string, choice: PlanChoice, meal: Meal | null) {
  return "recipe" in choice ? { date, recipeId: choice.recipe.id, text: choice.recipe.name, meal } : { date, text: choice.text, meal };
}

/**
 * The day as it stands: tonight's meal and the way into cooking it, the week
 * at a glance, what is left to buy, whether next week is planned, and what has
 * been kept but never made. The place a glance lands; choosing from the whole
 * library is Recipes, planning a week is Plan.
 *
 * One brand fill (design-language rule 5): Cook, except at the weekend while
 * next week is empty, when planning it is the thing to do.
 */
export function HomePage() {
  const data = route.useLoaderData();
  const layout = useLayout();
  const mutate = useMutate();
  const [busy, setBusy] = useState(false);

  const write = async (what: string, run: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await mutate(run);
    } catch (error) {
      toastError(what, error);
    } finally {
      setBusy(false);
    }
  };

  // A desktop's Home is a different structure, tiles across the width (decisions.md row 207).
  if (layout === "desktop") return <HomeBento {...data} />;
  return (
    <PhoneHome
      {...data}
      busy={busy}
      searchRecipes={searchPlanRecipes}
      onAdd={(date, choice, meal) => void write("Couldn't add to the plan", () => addPlanEntry({ data: entryInput(date, choice, meal) }))}
      // The new entry goes where the old one was, so it is still the one Home
      // calls tonight's, and the old one goes: one write, so a failure leaves
      // the day as it was rather than holding both.
      onSwap={(entry, choice, meal) =>
        void write("Couldn't swap tonight", () => replacePlanEntry({ data: { id: entry.id, entry: entryInput(entry.date, choice, meal) } }))
      }
    />
  );
}
