import { createFileRoute } from "@tanstack/react-router";

/** GET /api/health — liveness probe for outside callers. */
export function handleHealth(_request: Request): Response {
  return Response.json({ ok: true });
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: ({ request }) => handleHealth(request),
    },
  },
});
