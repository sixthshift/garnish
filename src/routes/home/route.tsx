import { createRoute, lazyRouteComponent, redirect } from "@tanstack/react-router";
import { type PlanDay, todayIso, weekMonday } from "../../domain/plan";
import type { RecipeSummary } from "../../domain/recipe";
import { listPlanWeek } from "../../server/fns/plan";
import { listRecipes } from "../../server/fns/recipes";
import { listShoppingItems } from "../../server/fns/shopping";
import { RecipeListSearch } from "../library/route";
import { Route as rootRoute } from "../root";
import { nextMonday } from "./components/today";

export type HomeData = {
  today: string;
  monday: string;
  days: PlanDay[];
  nextDays: PlanDay[];
  /** Lines still to buy, or null when the list could not be read: Home still draws the day. */
  toBuy: number | null;
  /** Every recipe, newest first: tonight's time comes from here, and the ones to try. */
  recipes: RecipeSummary[];
};

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  // `/` was the recipe grid until decisions.md row 190: an old link or bookmark
  // carrying its filters (`/?tag=weeknight`) goes on to the grid with them.
  beforeLoad: ({ location }) => {
    const filters = Object.fromEntries(Object.entries(location.search as Record<string, unknown>).filter(([key]) => key in RecipeListSearch.shape));
    if (Object.keys(filters).length === 0) return;
    // A value the grid no longer accepts is dropped rather than failing the page.
    const parsed = RecipeListSearch.safeParse(filters);
    throw redirect({ to: "/recipes", search: parsed.success ? parsed.data : {} });
  },
  loader: async (): Promise<HomeData> => {
    const today = todayIso();
    const monday = weekMonday(undefined, today);
    const [days, nextDays, items, recipes] = await Promise.all([
      listPlanWeek({ data: { monday } }),
      listPlanWeek({ data: { monday: nextMonday(monday) } }),
      listShoppingItems().catch(() => null),
      listRecipes({ data: { sort: "created", dir: "desc" } }),
    ]);
    return { today, monday, days, nextDays, toBuy: items === null ? null : items.filter((item) => !item.ticked).length, recipes };
  },
  component: lazyRouteComponent(() => import("./page"), "HomePage"),
});
