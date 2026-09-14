// plan: the route. What the URL carries, what the loader reads, and
// the page it renders, loaded on demand. The page itself is page.tsx.
import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { Route as rootRoute } from "../root";
import { z } from "zod";
import { weekMonday, type PlanDay } from "../../domain/plan/plan";
import { listPlanWeek } from "../../server/fns/plan";

/** `?week=` is the Monday's date; anything else falls back to this week. */
export const PlanSearch = z.object({ week: z.string().optional() });

export type PlanWeekData = { monday: string; days: PlanDay[] };

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/plan",
  validateSearch: PlanSearch,
  loaderDeps: ({ search: { week } }) => ({ week }),
  loader: async ({ deps }): Promise<PlanWeekData> => {
    const monday = weekMonday(deps.week);
    return { monday, days: await listPlanWeek({ data: { monday } }) };
  },
  component: lazyRouteComponent(() => import("./page"), "PlanPage"),
});
