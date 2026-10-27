// The MCP door over HTTP (decisions.md row 181): the MCP endpoint, the OAuth server in front of it,
// and the two metadata documents a client reads to find its way from one to the other.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import mcp from "../../db/models/mcp/repo";
import { mcpSettings } from "../mcp/config";
import { fetchClientDocument } from "../mcp/oauth/clients";
import { oauthServer } from "../mcp/oauth/server";
import { buildMcpServer } from "../mcp/tools";

/** The one OAuth server: its authorization codes and attempt counters live in it, so there is one per process. */
export const oauth = oauthServer({
  settings: (request) => mcpSettings(request),
  repo: mcp,
  now: () => new Date(),
  fetchClientDocument,
});

/**
 * POST /api/mcp (and GET, DELETE): one MCP request from a client holding an
 * access token. Stateless: every request builds the server its token's
 * scopes allow and answers in JSON, so nothing outlives the request and no
 * session map grows. Without a good token, the 401 that starts the OAuth flow.
 */
export async function handleMcp(request: Request): Promise<Response> {
  const caller = oauth.authenticate(request);
  if (!caller) return oauth.challenge(request, request.headers.has("authorization") ? "invalid_token" : undefined);
  // Stateless mode has no stream to hold open and no session to end.
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });

  const server = buildMcpServer(caller);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request, {
      authInfo: { token: "", clientId: caller.clientId, scopes: caller.scopes, extra: { grantId: caller.grantId } },
    });
  } finally {
    await server.close();
  }
}
