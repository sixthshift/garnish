import { createFileRoute } from "@tanstack/react-router";
import { handleRecipeCook } from "../../../server/api/export";

/**
 * GET /api/recipes/:slug.cook — one recipe as a Cooklang file (M34.2). The
 * `.cook` is a suffix on the `slug` param, the same file-name convention as
 * `{$slug}[.]json.ts` (M34.1): `[.]` escapes the dot the file-route
 * convention would otherwise split on, and `{$slug}` ends the param there.
 */
export const Route = createFileRoute("/api/recipes/{$slug}.cook")({
  server: {
    handlers: {
      GET: ({ params }) => handleRecipeCook(params.slug),
    },
  },
});
