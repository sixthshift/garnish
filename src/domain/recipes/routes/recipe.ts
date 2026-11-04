import { createRoute } from "@tanstack/react-router";
import { recipes } from "./recipes";

/**
 * One recipe's addresses, under `/recipes/$slug`: a path only. Each page loads
 * the recipe itself, with what else it needs, so the loaders stay on the leaves.
 */
export const recipe = createRoute({
  getParentRoute: () => recipes,
  path: "$slug",
});
