import { createRoute, lazyRouteComponent, redirect } from "@tanstack/react-router";
import { listPlanWeek } from "../../../api/rpc/plan";
import { listRecipes } from "../../../api/rpc/recipes";
import { listShoppingItems } from "../../../api/rpc/shopping";
import { Route as rootRoute } from "../../../routes/root";
import { nextMonday, todayIso, weekMonday } from "../../plan/plan";
import { RecipeListSearch } from "../../recipes/routes/recipesIndex";
import type { HomeData } from "../home";

export const homeRoute = createRoute({
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
    return { today, monday, days, nextDays, toBuy: items === null ? null : items.filter((item) => !item.ticked).length, items, recipes };
  },
  component: lazyRouteComponent(() => import("../pages/HomePage"), "HomePage"),
});
