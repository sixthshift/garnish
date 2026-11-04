import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { addPlanEntry, movePlanEntry, removePlanEntry } from "../../../api/rpc/plan";
import { useMutate } from "../../../lib/mutate";
import { toastError } from "../../../lib/toast";
import { PlanWeekView } from "../components/week/PlanWeekView";
import { searchPlanRecipes } from "../components/week/searchPlanRecipes";

const route = getRouteApi("/plan/");

/** The route's wiring: the loader's week in, the server functions out. */
export function PlanPage() {
  const { monday, days } = route.useLoaderData();
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

  return (
    <PlanWeekView
      monday={monday}
      days={days}
      busy={busy}
      searchRecipes={searchPlanRecipes}
      onAddText={(date, text, meal) => void write("Couldn't add the line", () => addPlanEntry({ data: { date, text, meal } }))}
      // The recipe's name travels with its id: the entry keeps reading as
      // something after the recipe is deleted and `recipe_id` goes null.
      onAddRecipe={(date, recipe, meal) =>
        void write("Couldn't add the recipe", () => addPlanEntry({ data: { date, recipeId: recipe.id, text: recipe.name, meal } }))
      }
      onMove={(entry, date, position) => void write("Couldn't move the entry", () => movePlanEntry({ data: { id: entry.id, date, position } }))}
      onRemove={(entry) => void write("Couldn't remove the entry", () => removePlanEntry({ data: { id: entry.id } }))}
    />
  );
}
