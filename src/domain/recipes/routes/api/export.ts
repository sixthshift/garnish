import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../../../../routes/root";
import { handleRecipeCook, handleRecipeJson } from "../../../../server/api/export";

/**
 * GET /api/recipes/:slug.json — one recipe's document. `{$slug}` ends
 * the param before the suffix, so `lemon-tart.json` is the slug `lemon-tart`.
 */
export const recipeJsonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/recipes/{$slug}.json",
  server: {
    handlers: {
      GET: ({ params }) => handleRecipeJson(params.slug),
    },
  },
});

/** GET /api/recipes/:slug.cook — one recipe as a Cooklang file. */
export const recipeCookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/recipes/{$slug}.cook",
  server: {
    handlers: {
      GET: ({ params }) => handleRecipeCook(params.slug),
    },
  },
});
