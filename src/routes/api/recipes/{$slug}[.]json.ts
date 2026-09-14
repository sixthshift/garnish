import { createFileRoute } from "@tanstack/react-router";
import { handleRecipeJson } from "../../../server/api/export";

/**
 * GET /api/recipes/:slug.json — one recipe's document (M34.1).
 *
 * The `.json` is a suffix on the `slug` param, not part of it: TanStack's file
 * convention splits a file name on dots, so the brackets escape the one that
 * belongs to the path and the braces mark where the param ends.
 */
export const Route = createFileRoute("/api/recipes/{$slug}.json")({
  server: {
    handlers: {
      GET: ({ params }) => handleRecipeJson(params.slug),
    },
  },
});
