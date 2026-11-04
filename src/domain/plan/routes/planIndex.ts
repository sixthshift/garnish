import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { listPlanWeek } from "../../../api/rpc/plan";
import { type PlanDay, weekMonday } from "../plan";
import { plan } from "./plan";

/** `?week=` is the Monday's date; anything else falls back to this week. */
export const PlanSearch = z.object({ week: z.string().optional() });

export type PlanWeekData = {
  monday: string;
  days: PlanDay[];
};

export const planIndex = createRoute({
  getParentRoute: () => plan,
  path: "/",
  validateSearch: PlanSearch,
  loaderDeps: ({ search: { week } }) => ({ week }),
  loader: async ({ deps }): Promise<PlanWeekData> => {
    const monday = weekMonday(deps.week);
    const days = await listPlanWeek({ data: { monday } });
    return { monday, days };
  },
  component: lazyRouteComponent(() => import("../pages/PlanPage"), "PlanPage"),
});
