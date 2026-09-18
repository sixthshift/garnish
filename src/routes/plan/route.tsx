import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { type PlanDay, weekMonday } from "../../domain/plan";
import type { PlannerMeal } from "../../domain/planner";
import { listPlanWeek } from "../../server/fns/plan";
import { listPlannerMeals, plannerAvailable } from "../../server/fns/planner";
import { Route as rootRoute } from "../root";

/** `?week=` is the Monday's date; anything else falls back to this week. */
export const PlanSearch = z.object({ week: z.string().optional() });

export type PlanWeekData = {
  monday: string;
  days: PlanDay[];
  /** A model is configured: the header gains Propose. */
  plannerAvailable: boolean;
  /** Which meals a proposal plans for, so the sheet can say so without a second read. */
  plannerMeals: PlannerMeal[];
};

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/plan",
  validateSearch: PlanSearch,
  loaderDeps: ({ search: { week } }) => ({ week }),
  loader: async ({ deps }): Promise<PlanWeekData> => {
    const monday = weekMonday(deps.week);
    // The planner's two reads are the header's business, not the week's: a
    // failure of either leaves the week drawn and Propose out of the way.
    const [days, available, meals] = await Promise.all([
      listPlanWeek({ data: { monday } }),
      plannerAvailable().catch(() => ({ available: false })),
      listPlannerMeals().catch((): PlannerMeal[] => []),
    ]);
    return { monday, days, plannerAvailable: available.available, plannerMeals: meals };
  },
  component: lazyRouteComponent(() => import("./page"), "PlanPage"),
});
