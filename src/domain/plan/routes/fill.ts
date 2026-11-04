import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { aiAvailable } from "../../../api/rpc/ai";
import { listPlanWeek } from "../../../api/rpc/plan";
import { listRecipes } from "../../../api/rpc/recipes";
import type { RecipeSummary } from "../../recipes/recipe";
import { addDays, type PlanDay, todayIso, weekMonday } from "../plan";
import { plan } from "./plan";

/** `?week=` is the Monday to fill; without it, next week, since the weekend is when a week is planned. */
export const PlanFillSearch = z.object({ week: z.string().optional() });

export type PlanFillData = {
  today: string;
  monday: string;
  /** The week being filled, as it stands. */
  days: PlanDay[];
  /** The week before it: what was eaten, so it is not offered again, and what did not happen, so it is. */
  previousDays: PlanDay[];
  /** Every recipe, newest first. */
  recipes: RecipeSummary[];
  /** A model is configured: it makes the first pass, from the planner guide (decisions.md row 194). */
  plannerAvailable: boolean;
};

export const planFill = createRoute({
  getParentRoute: () => plan,
  path: "fill",
  validateSearch: PlanFillSearch,
  // A task finished with Add or Cancel: the phone's tab bar steps aside.
  staticData: { hideNav: true },
  loaderDeps: ({ search: { week } }) => ({ week }),
  loader: async ({ deps }): Promise<PlanFillData> => {
    const today = todayIso();
    const monday = weekMonday(deps.week ?? addDays(today, 7), today);
    // Whether a model is configured is the first pass's business, not the week's: a failure plans without one.
    const [days, previousDays, recipes, available] = await Promise.all([
      listPlanWeek({ data: { monday } }),
      listPlanWeek({ data: { monday: addDays(monday, -7) } }),
      listRecipes({ data: {} }),
      aiAvailable().catch(() => ({ available: false })),
    ]);
    return { today, monday, days, previousDays, recipes, plannerAvailable: available.available };
  },
  component: lazyRouteComponent(() => import("../pages/PlanFillPage"), "PlanFillPage"),
});
