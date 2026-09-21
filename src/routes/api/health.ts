import { createRoute } from "@tanstack/react-router";
import { VERSION } from "../../lib/version";
import { Route as rootRoute } from "../root";

/** GET /api/health — liveness probe for outside callers, and what version answered. */
export function handleHealth(_request: Request): Response {
  return Response.json({ ok: true, version: VERSION });
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
