// Connecting from nothing, as an MCP client does it: the SDK's own client and its own OAuth code, every
// request through garnish's real route table, and a person's part — the consent page, the pairing code,
// Allow — played by the test. Where endpoint.test.ts hands the client a key, this one has it earn one.

import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { beforeEach, expect, test } from "vitest";
import mcp from "../../../src/db/models/mcp/repo";
import { apiRoutes } from "../../../src/routes/api/routes";
import { resetSafetyBackups } from "../../../src/server/mcp/safety";
import { useTempDataDir } from "../../helpers/server";

useTempDataDir({ starterFoods: true });
const ORIGIN = "https://garnish.example";
const CALLBACK = "http://127.0.0.1:33418/callback";

beforeEach(() => resetSafetyBackups());

type Handler = (ctx: { request: Request; params: Record<string, string> }) => Response | Promise<Response>;
const routes = new Map(
  apiRoutes.map((route) => {
    const { path, server } = route.options as { path: string; server?: { handlers?: Record<string, Handler> } };
    return [path, server?.handlers ?? {}] as const;
  })
);

/** garnish, as the internet sees it: each request to its route's handler, as Start would send it. */
async function garnish(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.origin !== ORIGIN) throw new Error(`The client went somewhere else: ${url}`);
  const handler = routes.get(url.pathname)?.[request.method];
  return handler ? handler({ request, params: {} }) : new Response("Not found", { status: 404 });
}

/** The client's memory, as an app keeps it: its registration, its PKCE verifier, its tokens, and where it sent the person. */
class Memory implements OAuthClientProvider {
  information?: OAuthClientInformationMixed;
  saved?: OAuthTokens;
  verifier = "";
  sentTo?: URL;
  readonly redirectUrl = CALLBACK;
  readonly clientMetadata: OAuthClientMetadata = {
    client_name: "Test assistant",
    redirect_uris: [CALLBACK],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
  clientInformation = () => this.information;
  saveClientInformation = (information: OAuthClientInformationMixed) => {
    this.information = information;
  };
  tokens = () => this.saved;
  saveTokens = (tokens: OAuthTokens) => {
    this.saved = tokens;
  };
  redirectToAuthorization = (url: URL) => {
    this.sentTo = url;
  };
  saveCodeVerifier = (verifier: string) => {
    this.verifier = verifier;
  };
  codeVerifier = () => this.verifier;
  /** What the SDK calls when garnish refuses what it holds: forget it, and sign in afresh. */
  invalidateCredentials = (scope: "all" | "client" | "tokens" | "verifier" | "discovery") => {
    if (scope === "all" || scope === "tokens") this.saved = undefined;
    if (scope === "all" || scope === "client") this.information = undefined;
  };
}

const transportFor = (memory: Memory) => new StreamableHTTPClientTransport(new URL(`${ORIGIN}/api/mcp`), { fetch: garnish, authProvider: memory });

/** The person at the consent page: read it, tick `grant`, type `pairingCode`, press Allow. The page's answer. */
async function allow(page: URL, pairingCode: string, grant = ["read", "write", "delete"]): Promise<Response> {
  const html = await (await garnish(page)).text();
  expect(html).toContain("Test assistant wants to use garnish");
  const form = new URLSearchParams([...html.matchAll(/type="hidden" name="([^"]+)" value="([^"]*)"/g)].map((m) => [m[1]!, m[2]!.replaceAll("&amp;", "&")]));
  for (const scope of grant) form.append("grant", scope);
  form.set("pairingCode", pairingCode);
  form.set("decision", "allow");
  return garnish(page, { method: "POST", body: form, headers: { "content-type": "application/x-www-form-urlencoded" } });
}

/** The authorization code from the browser's trip back to the client, checked as the client would. */
function codeFrom(answer: Response): string {
  expect(answer.status).toBe(302);
  const back = new URL(answer.headers.get("location")!);
  expect(`${back.origin}${back.pathname}`).toBe(CALLBACK);
  expect(back.searchParams.get("iss")).toBe(ORIGIN);
  return back.searchParams.get("code")!;
}

/** From nothing to a connected client: the 401, discovery, registration, consent, the code for tokens, then connect. */
async function connectWithCode(memory: Memory, grant?: string[]): Promise<Client> {
  await expect(new Client({ name: "test", version: "1.0.0" }).connect(transportFor(memory))).rejects.toThrow(UnauthorizedError);
  const first = transportFor(memory);
  await first.finishAuth(codeFrom(await allow(memory.sentTo!, mcp.pairingCode(), grant)));
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(transportFor(memory));
  return client;
}

test("a client finds its way in from a bare 401, signs in with the pairing code, and uses the tools", async () => {
  const memory = new Memory();
  const code = mcp.pairingCode();

  // The first attempt: no token, so the SDK reads the metadata, registers, and sends the person to the consent page.
  await expect(new Client({ name: "test", version: "1.0.0" }).connect(transportFor(memory))).rejects.toThrow(UnauthorizedError);
  expect(memory.information?.client_id).toBeTruthy();
  expect(`${memory.sentTo!.origin}${memory.sentTo!.pathname}`).toBe(`${ORIGIN}/api/oauth/authorize`);
  expect(memory.sentTo!.searchParams.get("code_challenge_method")).toBe("S256");
  expect(memory.sentTo!.searchParams.get("resource")).toBe(`${ORIGIN}/api/mcp`);

  // A wrong code is refused on the page, with no trip back to the client.
  const wrong = await allow(memory.sentTo!, "AAAA-AAAA-AAAA");
  expect(wrong.status).toBe(401);
  expect(await wrong.text()).toContain("That code is not right.");

  // The right one, typed loosely: back to the client with a code, which it trades for tokens.
  const transport = transportFor(memory);
  await transport.finishAuth(codeFrom(await allow(memory.sentTo!, code.toLowerCase())));
  expect(memory.saved?.access_token).toMatch(/^gat_/);
  expect(memory.saved?.refresh_token).toMatch(/^grt_/);

  // The code is spent, and Settings lists the connection.
  expect(mcp.pairingCode()).not.toBe(code);
  expect(mcp.connections().map((row) => [row.clientName, row.scope])).toEqual([["Test assistant", "read write delete"]]);

  // Connected: the tools, and a write that lands.
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(transportFor(memory));
  expect(client.getInstructions()).toContain("A recipe is an ordered list of parts");
  expect((await client.listTools()).tools).toHaveLength(15);
  const created = (await client.callTool({
    name: "create_recipe",
    arguments: { name: "Signed-in pancakes", parts: [{ ingredients: ["250 g plain flour"], steps: ["Mix."] }] },
  })) as { isError?: boolean; content: { text: string }[] };
  expect(created.isError).toBeFalsy();
  expect(JSON.parse(created.content[0]!.text).recipe.name).toBe("Signed-in pancakes");
  await client.close();
});

test("what the person ticks is what the client gets", async () => {
  const client = await connectWithCode(new Memory(), ["read"]);
  const names = (await client.listTools()).tools.map((tool) => tool.name);
  expect(names).toContain("search_recipes");
  expect(names).not.toContain("create_recipe");
  await client.close();
});

test("Disconnect in Settings shuts the client out, and it has to ask again with the new code", async () => {
  const memory = new Memory();
  const client = await connectWithCode(memory);
  mcp.revokeGrant(mcp.connections()[0]!.id);
  await expect(client.listTools()).rejects.toThrow();
  await client.close();

  // Its old tokens are worthless; a fresh sign-in, with the code as it is now, gets it back.
  const again = await connectWithCode(memory);
  expect((await again.listTools()).tools.length).toBeGreaterThan(0);
  await again.close();
});
