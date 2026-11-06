import { toast } from "@sixthshift/design-system/overlay";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { addPlanEntry, listPlanWeek } from "../../../api/rpc/plan";
import { listRecipes } from "../../../api/rpc/recipes";
import { addShoppingItems } from "../../../api/rpc/shopping";
import { dayName, nextMonday, type PlanDay, todayIso, weekMonday } from "../../../domain/plan/plan";
import { useMutate } from "../../../lib/mutate";
import { clampSelection } from "../../../lib/search";
import { toastError } from "../../../lib/toast";
import { buildOptions, type CommandOption, type CommandRecipe, parseQuery, searchTermOf, suggestions } from "./commands";

/** How long typing pauses before the recipe search runs. */
const SEARCH_DEBOUNCE_MS = 150;

/**
 * What the empty bar offers from the plan: tonight's recipes and next week's
 * empty nights; and the recipes planned across both weeks, which a phone's
 * example chips are made from.
 */
type PlanGlance = { tonight: CommandRecipe[]; nextWeek: { monday: string; emptyNights: number }; planned: CommandRecipe[] };

const recipesOf = (days: PlanDay[]): CommandRecipe[] => days.flatMap((day) => day.entries.flatMap((entry) => (entry.recipe ? [entry.recipe] : [])));

/** Read the plan once, for the empty bar. A failure leaves it out rather than failing the bar. */
async function readPlan(today: string): Promise<PlanGlance> {
  const monday = weekMonday(undefined, today);
  const next = nextMonday(monday);
  const [days, nextDays] = (await Promise.all([listPlanWeek({ data: { monday } }), listPlanWeek({ data: { monday: next } })])) as [PlanDay[], PlanDay[]];
  const tonight = recipesOf(days.filter((day) => day.date === today));
  const planned = [...new Map(recipesOf([...days, ...nextDays]).map((recipe) => [recipe.id, recipe])).values()];
  return { tonight, nextWeek: { monday: next, emptyNights: nextDays.filter((day) => day.entries.length === 0).length }, planned };
}

/**
 * The command bar's state and its doing (decisions.md rows 207 and 208),
 * shared by a desktop's palette and a phone's + sheet: what was typed, the
 * options it makes (`commands.ts`), the one highlighted, and `run`, which
 * closes the bar and opens a recipe, puts one on a day, adds a line to the
 * shopping list or goes to a page. Each draws it in its own way.
 */
export function useCommands({ onClose, today: fixedToday }: { onClose: () => void; today?: string }) {
  const today = fixedToday ?? todayIso();
  const navigate = useNavigate();
  const mutate = useMutate();
  const [query, setQueryState] = useState("");
  const [selected, setSelected] = useState(0);
  const [recipes, setRecipes] = useState<CommandRecipe[]>([]);
  const [plan, setPlan] = useState<PlanGlance | null>(null);

  useEffect(() => {
    let live = true;
    readPlan(today).then(
      (glance) => live && setPlan(glance),
      () => {}
    );
    return () => {
      live = false;
    };
  }, [today]);

  // Ask for the longest term; `buildOptions` keeps what holds every term, so
  // results that arrive a keystroke late still only show what fits.
  const term = searchTermOf(parseQuery(query, today).terms);
  useEffect(() => {
    if (term === null) return;
    let live = true;
    const timer = setTimeout(() => {
      listRecipes({ data: { q: term, sort: "name", dir: "asc" } }).then(
        (found) => live && setRecipes(found),
        () => live && setRecipes([])
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [term]);

  const options = useMemo(
    () => buildOptions({ query, today, recipes, tonight: plan?.tonight, nextWeek: plan?.nextWeek ?? null }),
    [query, today, recipes, plan]
  );
  const examples = useMemo(() => suggestions(plan?.planned ?? [], today), [plan, today]);
  const active = clampSelection(selected, options.length);

  /** Type into the box: the highlight goes back to the first option. */
  const setQuery = (next: string) => {
    setQueryState(next);
    setSelected(0);
  };

  const run = async (option: CommandOption | undefined) => {
    if (option === undefined) return;
    onClose();
    switch (option.kind) {
      case "open":
        await navigate({ to: "/recipes/$slug", params: { slug: option.recipe.slug } });
        return;
      case "go":
        await navigate({ to: option.target.to, search: option.target.search });
        return;
      case "plan":
        try {
          // The name travels with the id, as the plan page's own add does.
          await mutate(() => addPlanEntry({ data: { date: option.date, recipeId: option.recipe.id, text: option.recipe.name } }));
          toast({ intent: "success", title: `${option.recipe.name} is on ${dayName(option.date)}` });
        } catch (error) {
          toastError("Couldn't plan the recipe", error);
        }
        return;
      case "shop":
        try {
          await mutate(() => addShoppingItems({ data: { items: [{ text: option.text }] } }));
          toast({ intent: "success", title: `Added “${option.text}” to the shopping list` });
        } catch (error) {
          toastError("Couldn't add to the shopping list", error);
        }
        return;
    }
  };

  return { today, query, setQuery, options, active, setSelected, run, examples };
}
