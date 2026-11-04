import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../../../routes/root";

/** The plan's addresses, under `/plan`: a path only, so nothing wraps its pages. */
export const plan = createRoute({
  getParentRoute: () => rootRoute,
  path: "plan",
});
