import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../../../routes/root";

/** The recipes' addresses, under `/recipes`: a path only, so nothing wraps their pages. */
export const recipes = createRoute({
  getParentRoute: () => rootRoute,
  path: "recipes",
});
