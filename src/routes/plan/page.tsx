// The meal plan (M33.2): one household plan, one week at a time, days rather
// than meals (decisions.md row 71).
//
// `?week=` is the Monday's date and the only state the page keeps in the URL,
// so the previous and next arrows are plain links and the loader re-runs on
// them like every other filtered read. A mid-week date normalises to its
// Monday (`weekMonday`), so a link from anywhere else in the app can name a
// day and still land on a whole week.
//
// Layout is the one the task asks for: seven columns from `md`, one vertical
// list of days below that, today marked. A day draws its entries as small
// cards and an add row that searches recipes as you type — the same result
// list the global search dialog uses (`SearchResultList`) — and, on text that
// matched nothing, adds a plain line on Enter ("leftovers").
//
// Adding a recipe copies the recipe's *name* into the entry's `text` as well
// as its id. The row keeps no other copy, and `recipe_id` goes null when a
// recipe is deleted; without the copied name that day would go blank a year
// later. `entryLabel` prefers the live recipe, so a rename still shows through.
//
// Entries move between days two ways: dragging, through `ReorderList`'s group
// drag (each day is a list in the `plan-week` group, and a row dropped on
// another day's list is reported once on release), and a row menu listing the
// other six days, which is the accessible path and the one that works on a
// phone. A drag inside one day is a reorder; `reorderMove` turns the whole
// rearranged array `ReorderList` hands back into the single move the
// repository takes.
//
// `PlanWeekView` takes its writes as callbacks and renders anywhere; the route
// component binds them to the server functions through `useMutate`, as
// `/shopping` does. That split is what the render tests exercise.
import { useState } from "react";
import { useMutate } from "../../lib/mutate";
import { notifyError } from "../../lib/notify";
import { addPlanEntry, movePlanEntry, removePlanEntry } from "../../server/fns/plan";
import { PlanWeekView, searchPlanRecipes } from "./components/PlanWeekView";
import { Route } from "./route";

/** The route's wiring: the loader's week in, the server functions out. */
export function PlanPage() {
  const { monday, days } = Route.useLoaderData();
  const mutate = useMutate();
  const [busy, setBusy] = useState(false);

  const write = async (what: string, run: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await mutate(run);
    } catch (error) {
      notifyError(what, error);
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
      onAddText={(date, text) => void write("Couldn't add the line", () => addPlanEntry({ data: { date, text } }))}
      // The recipe's name travels with its id: the entry keeps reading as
      // something after the recipe is deleted and `recipe_id` goes null.
      onAddRecipe={(date, recipe) => void write("Couldn't add the recipe", () => addPlanEntry({ data: { date, recipeId: recipe.id, text: recipe.name } }))}
      onMove={(entry, date, position) => void write("Couldn't move the entry", () => movePlanEntry({ data: { id: entry.id, date, position } }))}
      onRemove={(entry) => void write("Couldn't remove the entry", () => removePlanEntry({ data: { id: entry.id } }))}
    />
  );
}
