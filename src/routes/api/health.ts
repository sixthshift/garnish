import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../root";

/** GET /api/health — liveness probe for outside callers. */
export function handleHealth(_request: Request): Response {
  return Response.json({ ok: true });
}

export const healthRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/health",
  server: {
    handlers: {
      GET: ({ request }) => handleHealth(request),
    },
  },
});
