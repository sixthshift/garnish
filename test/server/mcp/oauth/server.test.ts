// The whole OAuth flow, through the server's handlers, over an in-memory database and a clock the test moves.
import { createHash } from "node:crypto";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../../../src/db/connection/open";
import { migrate } from "../../../../src/db/migrations/migrate";
import { type McpRepository, mcpRepository } from "../../../../src/db/models/mcp/repo";
import { mcpSettings } from "../../../../src/server/mcp/config";
import { type OauthServer, oauthServer, PAIRING_ATTEMPTS_PER_MINUTE } from "../../../../src/server/mcp/oauth/server";

const ORIGIN = "https://garnish.example";
const CALLBACK = "https://claude.ai/api/mcp/auth_callback";
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");
const METADATA_URL = "https://claude.ai/oauth/mcp-oauth-client-metadata";

let repo: McpRepository;
let server: OauthServer;
let now: Date;
let env: Record<string, string | undefined>;
let documents: string[];

beforeEach(() => {
  const db = openDatabase(":memory:");
  migrate(db);
  repo = mcpRepository(db);
  now = new Date("2026-10-26T10:00:00.000Z");
  env = {};
  documents = [];
  server = oauthServer({
    settings: (request) => mcpSettings(request, env),
    repo,
    now: () => now,
    fetchClientDocument: async (url) => {
      documents.push(url);
      return { client_id: url, client_name: "Claude", redirect_uris: [CALLBACK] };
    },
  });
});

const post = (path: string, body: Record<string, string | string[]>, headers: Record<string, string> = {}) => {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) for (const one of Array.isArray(value) ? value : [value]) form.append(key, one);
  return new Request(`${ORIGIN}${path}`, { method: "POST", body: form, headers: { "content-type": "application/x-www-form-urlencoded", ...headers } });
};

async function register(body: Record<string, unknown> = { client_name: "Claude", redirect_uris: [CALLBACK], token_endpoint_auth_method: "none" }) {
  const response = await server.register(
    new Request(`${ORIGIN}/api/oauth/register`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } })
  );
  return { response, body: (await response.json()) as Record<string, string> };
}

const authorizeQuery = (clientId: string, over: Record<string, string> = {}) =>
  new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: CALLBACK,
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    state: "xyz",
    resource: `${ORIGIN}/api/mcp`,
    ...over,
  });

const consent = (clientId: string, over: Record<string, string | string[]> = {}) =>
  post("/api/oauth/authorize", {
    clientId,
    redirectUri: CALLBACK,
    state: "xyz",
    codeChallenge: CHALLENGE,
    scope: "read write delete",
    resource: `${ORIGIN}/api/mcp`,
    grant: ["read", "write", "delete"],
    // The code as it stands now: every Allow replaces it.
    pairingCode: repo.pairingCode(),
    decision: "allow",
    ...over,
  });

/** Through the consent page to a code. */
async function codeFor(clientId: string, over: Record<string, string | string[]> = {}): Promise<string> {
  const response = await server.authorizeAnswer(consent(clientId, over));
  expect(response.status).toBe(302);
  const location = new URL(response.headers.get("location")!);
  expect(location.searchParams.get("state")).toBe("xyz");
  expect(location.searchParams.get("iss")).toBe(ORIGIN);
  return location.searchParams.get("code")!;
}

async function exchange(clientId: string, code: string, verifier = VERIFIER) {
  const response = await server.token(
    post("/api/oauth/token", { grant_type: "authorization_code", client_id: clientId, code, redirect_uri: CALLBACK, code_verifier: verifier })
  );
  return { response, body: (await response.json()) as Record<string, string> };
}

const bearer = (token: string) => new Request(`${ORIGIN}/api/mcp`, { method: "POST", headers: { authorization: `Bearer ${token}` } });

const get = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

test("the addresses follow the request: the LAN gets the LAN's, a tunnel the public one, GARNISH_PUBLIC_URL wins", async () => {
  const lan = (await server.authorizationServer(get("http://192.168.1.5:9988/.well-known/oauth-authorization-server")).json()) as Record<string, string>;
  expect(lan).toMatchObject({ issuer: "http://192.168.1.5:9988", token_endpoint: "http://192.168.1.5:9988/api/oauth/token" });
  const tunnel = get("http://localhost:9988/.well-known/oauth-protected-resource/api/mcp", { host: "garnish.example.com", "x-forwarded-proto": "https" });
  expect(await server.protectedResource(tunnel).json()).toMatchObject({
    resource: "https://garnish.example.com/api/mcp",
    authorization_servers: ["https://garnish.example.com"],
  });
  env = { GARNISH_PUBLIC_URL: "https://pinned.example" };
  expect(await server.protectedResource(get("http://192.168.1.5:9988/x")).json()).toMatchObject({ resource: "https://pinned.example/api/mcp" });
});

test("a token works only at the address it was issued for", async () => {
  const { body: client } = await register();
  const { body: tokens } = await exchange(client.client_id!, await codeFor(client.client_id!));
  expect(server.authenticate(bearer(tokens.access_token!))).not.toBeNull();
  const elsewhere = new Request("http://192.168.1.5:9988/api/mcp", { method: "POST", headers: { authorization: `Bearer ${tokens.access_token}` } });
  expect(server.authenticate(elsewhere)).toBeNull();
});

test("the metadata documents name the resource, the issuer and every endpoint", async () => {
  expect(await server.protectedResource(get(`${ORIGIN}/.well-known/oauth-protected-resource`)).json()).toMatchObject({
    resource: `${ORIGIN}/api/mcp`,
    authorization_servers: [ORIGIN],
  });
  expect(await server.authorizationServer(get(`${ORIGIN}/.well-known/oauth-authorization-server`)).json()).toMatchObject({
    issuer: ORIGIN,
    authorization_endpoint: `${ORIGIN}/api/oauth/authorize`,
    token_endpoint: `${ORIGIN}/api/oauth/token`,
    registration_endpoint: `${ORIGIN}/api/oauth/register`,
    code_challenge_methods_supported: ["S256"],
    client_id_metadata_document_supported: true,
  });
});

test("the 401 without a token points at the protected-resource metadata", async () => {
  const response = server.challenge(get(`${ORIGIN}/api/mcp`));
  expect(response.status).toBe(401);
  expect(response.headers.get("www-authenticate")).toContain(`resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/api/mcp"`);
});

test("register, consent, exchange, use: the whole flow", async () => {
  const { response, body: client } = await register();
  expect(response.status).toBe(201);
  expect(client.client_secret).toBeUndefined();

  const page = await server.authorizePage(new Request(`${ORIGIN}/api/oauth/authorize?${authorizeQuery(client.client_id!)}`));
  expect(page.status).toBe(200);
  expect(page.headers.get("x-frame-options")).toBe("DENY");
  const html = await page.text();
  expect(html).toContain("Claude wants to use garnish");
  expect(html).toContain('name="pairingCode"');

  const code = await codeFor(client.client_id!);
  const { response: tokenResponse, body: tokens } = await exchange(client.client_id!, code);
  expect(tokenResponse.status).toBe(200);
  expect(tokenResponse.headers.get("cache-control")).toBe("no-store");
  expect(tokens).toMatchObject({ token_type: "Bearer", scope: "read write delete" });
  expect(tokens.access_token).toMatch(/^gat_/);

  expect(server.authenticate(bearer(tokens.access_token!))).toMatchObject({ clientName: "Claude", scopes: ["read", "write", "delete"] });
  expect(repo.connections()).toHaveLength(1);
  expect(repo.connections()[0]!.lastUsedAt).toBe(now.toISOString());
  // Only hashes are kept.
  expect(repo.token(tokens.access_token!)).toBeNull();
});

test("Allow spends the pairing code: the next connection needs the new one", async () => {
  const { body: client } = await register();
  const first = repo.pairingCode();
  await codeFor(client.client_id!, { pairingCode: first });
  const second = repo.pairingCode();
  expect(second).not.toBe(first);
  const again = await server.authorizeAnswer(consent(client.client_id!, { pairingCode: first }));
  expect(again.status).toBe(401);
  // Typed loosely — lower case, no dashes — the live code still reads.
  await codeFor(client.client_id!, { pairingCode: second.toLowerCase().replaceAll("-", "") });
});

test("a wrong code re-shows the page and keeps the code; too many in a minute wait out the minute", async () => {
  const { body: client } = await register();
  const live = repo.pairingCode();
  const wrong = await server.authorizeAnswer(consent(client.client_id!, { pairingCode: "AAAA-AAAA-AAAA" }));
  expect(wrong.status).toBe(401);
  expect(await wrong.text()).toContain("That code is not right.");
  expect(repo.pairingCode()).toBe(live);
  for (let i = 1; i < PAIRING_ATTEMPTS_PER_MINUTE; i++) await server.authorizeAnswer(consent(client.client_id!, { pairingCode: "nope" }));
  const waiting = await server.authorizeAnswer(consent(client.client_id!));
  expect(waiting.status).toBe(429);
  expect(repo.pairingCode()).toBe(live);
  now = new Date(now.getTime() + 61 * 1000);
  expect((await server.authorizeAnswer(consent(client.client_id!))).status).toBe(302);
});

test("Allow with nothing ticked asks again, and does not spend the code", async () => {
  const { body: client } = await register();
  const live = repo.pairingCode();
  const response = await server.authorizeAnswer(consent(client.client_id!, { grant: [] }));
  expect(await response.text()).toContain("Tick at least one thing");
  expect(repo.pairingCode()).toBe(live);
});

test("Deny sends the browser back with access_denied and no code", async () => {
  const { body: client } = await register();
  const response = await server.authorizeAnswer(consent(client.client_id!, { decision: "deny", pairingCode: "" }));
  const location = new URL(response.headers.get("location")!);
  expect(location.searchParams.get("error")).toBe("access_denied");
  expect(location.searchParams.get("code")).toBeNull();
});

test("unticked scopes are not granted", async () => {
  const { body: client } = await register();
  const code = await codeFor(client.client_id!, { grant: ["read"] });
  const { body: tokens } = await exchange(client.client_id!, code);
  expect(tokens.scope).toBe("read");
  expect(server.authenticate(bearer(tokens.access_token!))?.scopes).toEqual(["read"]);
});

test("an unregistered redirect address is refused on the page, never redirected to", async () => {
  const { body: client } = await register();
  const response = await server.authorizePage(
    new Request(`${ORIGIN}/api/oauth/authorize?${authorizeQuery(client.client_id!, { redirect_uri: "https://evil.example/cb" })}`)
  );
  expect(response.status).toBe(400);
  expect(response.headers.get("location")).toBeNull();
});

test("a request without PKCE, or for another resource, goes back as an error", async () => {
  const { body: client } = await register();
  const noPkce = await server.authorizePage(
    new Request(`${ORIGIN}/api/oauth/authorize?${authorizeQuery(client.client_id!, { code_challenge_method: "plain" })}`)
  );
  expect(new URL(noPkce.headers.get("location")!).searchParams.get("error")).toBe("invalid_request");
  const elsewhere = await server.authorizePage(
    new Request(`${ORIGIN}/api/oauth/authorize?${authorizeQuery(client.client_id!, { resource: "https://other.example/mcp" })}`)
  );
  expect(new URL(elsewhere.headers.get("location")!).searchParams.get("error")).toBe("invalid_target");
});

test("a code is used once, by its own client, with its own verifier, inside two minutes", async () => {
  const { body: client } = await register();
  const { body: other } = await register();

  const code = await codeFor(client.client_id!);
  expect((await exchange(client.client_id!, code, `${VERIFIER}x`)).body.error).toBe("invalid_grant");
  // Taken by the failed try: a code never gets a second guess.
  expect((await exchange(client.client_id!, code)).body.error).toBe("invalid_grant");

  const stolen = await codeFor(client.client_id!);
  expect((await exchange(other.client_id!, stolen)).body.error).toBe("invalid_grant");

  const late = await codeFor(client.client_id!);
  now = new Date(now.getTime() + 3 * 60 * 1000);
  expect((await exchange(client.client_id!, late)).body.error).toBe("invalid_grant");
});

test("a confidential client must send its secret", async () => {
  const { body: client } = await register({ client_name: "Desk", redirect_uris: [CALLBACK] });
  expect(client.client_secret).toMatch(/^gcs_/);
  const code = await codeFor(client.client_id!);
  expect((await exchange(client.client_id!, code)).response.status).toBe(401);
  const again = await codeFor(client.client_id!);
  const basic = `Basic ${Buffer.from(`${client.client_id}:${client.client_secret}`).toString("base64")}`;
  const response = await server.token(
    post("/api/oauth/token", { grant_type: "authorization_code", code: again, redirect_uri: CALLBACK, code_verifier: VERIFIER }, { authorization: basic })
  );
  expect(response.status).toBe(200);
});

test("an access token expires after an hour and works only for this resource", async () => {
  const { body: client } = await register();
  const { body: tokens } = await exchange(client.client_id!, await codeFor(client.client_id!));
  now = new Date(now.getTime() + 61 * 60 * 1000);
  expect(server.authenticate(bearer(tokens.access_token!))).toBeNull();
});

test("a refresh replaces both tokens; a spent refresh token is tolerated briefly, then revokes the grant", async () => {
  const { body: client } = await register();
  const { body: first } = await exchange(client.client_id!, await codeFor(client.client_id!));
  const refresh = (token: string) =>
    server.token(post("/api/oauth/token", { grant_type: "refresh_token", client_id: client.client_id!, refresh_token: token }));

  const second = (await (await refresh(first.refresh_token!)).json()) as Record<string, string>;
  expect(second.access_token).toMatch(/^gat_/);
  expect(second.refresh_token).not.toBe(first.refresh_token);

  // A retry within the grace gets a pair too.
  now = new Date(now.getTime() + 10 * 1000);
  expect((await refresh(first.refresh_token!)).status).toBe(200);

  // Later, the old token again is a stolen one: the grant goes, and every token under it.
  now = new Date(now.getTime() + 60 * 1000);
  expect((await refresh(first.refresh_token!)).status).toBe(400);
  expect(server.authenticate(bearer(second.access_token!))).toBeNull();
  expect(repo.connections()).toEqual([]);
});

test("revoke hangs up the whole connection", async () => {
  const { body: client } = await register();
  const { body: tokens } = await exchange(client.client_id!, await codeFor(client.client_id!));
  const response = await server.revoke(post("/api/oauth/revoke", { token: tokens.refresh_token!, client_id: client.client_id! }));
  expect(response.status).toBe(200);
  expect(server.authenticate(bearer(tokens.access_token!))).toBeNull();
});

test("a client known by its metadata document needs no registration, and is kept once allowed in", async () => {
  const page = await server.authorizePage(new Request(`${ORIGIN}/api/oauth/authorize?${authorizeQuery(METADATA_URL)}`));
  expect(page.status).toBe(200);
  expect(await page.text()).toContain("<code>claude.ai</code>");
  expect(repo.client(METADATA_URL)).toBeNull();

  const code = await codeFor(METADATA_URL);
  // The page and its answer read the document once between them.
  expect(documents).toEqual([METADATA_URL]);
  expect(repo.client(METADATA_URL)).toMatchObject({ kind: "metadata", name: "Claude" });
  const { body: tokens } = await exchange(METADATA_URL, code);
  expect(server.authenticate(bearer(tokens.access_token!))).toMatchObject({ clientId: METADATA_URL });
});

test("registration refuses a redirect address that is neither https nor local", async () => {
  const { response, body } = await register({ client_name: "Bad", redirect_uris: ["http://evil.example/cb"], token_endpoint_auth_method: "none" });
  expect(response.status).toBe(400);
  expect(body.error).toBe("invalid_redirect_uri");
});
