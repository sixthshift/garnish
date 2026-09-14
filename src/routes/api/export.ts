import { createRoute } from "@tanstack/react-router";
import { handleExportJson, handleRecipeCook, handleRecipeJson } from "../../server/api/export";
import { Route as rootRoute } from "../root";

/** GET /api/export.json — every recipe plus the reference tables (M34.1). */
export const exportJsonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/export.json",
  server: {
    handlers: {
      GET: () => handleExportJson(),
    },
  },
});

/**
 * GET /api/recipes/:slug.json — one recipe's document (M34.1). `{$slug}` ends
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

/** GET /api/recipes/:slug.cook — one recipe as a Cooklang file (M34.2). */
export const recipeCookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/recipes/{$slug}.cook",
  server: {
    handlers: {
      GET: ({ params }) => handleRecipeCook(params.slug),
    },
  },
});
