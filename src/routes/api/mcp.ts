import { createRoute } from "@tanstack/react-router";
import { handleMcp, oauth } from "../../server/api/mcp";
import { Route as rootRoute } from "../root";

// The MCP door (decisions.md row 181). The only server routes outside /api/*: RFC 8414 and
// RFC 9728 fix the metadata at /.well-known/ under the issuer's origin, so a client finds them
// without being told. Every address in them is built from the request (or GARNISH_PUBLIC_URL).

/** POST /api/mcp — the MCP endpoint, for a client holding an access token. */
export const mcpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/mcp",
  server: {
    handlers: {
      POST: ({ request }) => handleMcp(request),
      GET: ({ request }) => handleMcp(request),
      DELETE: ({ request }) => handleMcp(request),
    },
  },
});

/** GET /.well-known/oauth-protected-resource/api/mcp — who guards the MCP endpoint (RFC 9728). */
export const protectedResourceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/.well-known/oauth-protected-resource/api/mcp",
  server: { handlers: { GET: ({ request }) => oauth.protectedResource(request) } },
});

/** GET /.well-known/oauth-protected-resource — the same, for a client that asks at the root. */
export const protectedResourceRootRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/.well-known/oauth-protected-resource",
  server: { handlers: { GET: ({ request }) => oauth.protectedResource(request) } },
});

/** GET /.well-known/oauth-authorization-server — where each step of the OAuth flow is (RFC 8414). */
export const authorizationServerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/.well-known/oauth-authorization-server",
  server: { handlers: { GET: ({ request }) => oauth.authorizationServer(request) } },
});

/** GET /api/oauth/authorize shows the consent page; POST is its answer. */
export const authorizeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/oauth/authorize",
  server: {
    handlers: {
      GET: ({ request }) => oauth.authorizePage(request),
      POST: ({ request }) => oauth.authorizeAnswer(request),
    },
  },
});

/** POST /api/oauth/token — a code or a refresh token for a pair of tokens. */
export const tokenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/oauth/token",
  server: { handlers: { POST: ({ request }) => oauth.token(request) } },
});

/** POST /api/oauth/register — a client introduces itself (RFC 7591). */
export const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/oauth/register",
  server: { handlers: { POST: ({ request }) => oauth.register(request) } },
});

/** POST /api/oauth/revoke — a client hangs up (RFC 7009). */
export const revokeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/oauth/revoke",
  server: { handlers: { POST: ({ request }) => oauth.revoke(request) } },
});
