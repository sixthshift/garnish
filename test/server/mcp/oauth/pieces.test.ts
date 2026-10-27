// The OAuth server's pure parts: the settings, the secrets, and who a client is.
import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { mcpSettings, publicOrigin, requestOrigin } from "../../../../src/server/mcp/config";
import { clientFromDocument, isMetadataClientId, privateAddress, redirectAllowed, redirectMatches } from "../../../../src/server/mcp/oauth/clients";
import { parseScope, readPairingCode, samePairingCode, sameSecret, verifyPkce } from "../../../../src/server/mcp/oauth/tokens";

const PASS = "correct horse battery";

test.each([
  [{ GARNISH_PUBLIC_URL: "http://g.example" }, "GARNISH_PUBLIC_URL must be https (http only for localhost)."],
  [{ GARNISH_PUBLIC_URL: "https://g.example/garnish" }, "GARNISH_PUBLIC_URL must be an origin alone, like https://garnish.example.com."],
  [{ GARNISH_PUBLIC_URL: "not a url" }, "GARNISH_PUBLIC_URL is not an address: not a url"],
])("publicOrigin(%j) is not used: %s", (env, problem) => {
  expect(publicOrigin(env)).toEqual({ origin: null, problem });
});

test("publicOrigin: unset is nothing to report; an origin, with or without its slash, is used", () => {
  expect(publicOrigin({})).toEqual({ origin: null, problem: null });
  expect(publicOrigin({ GARNISH_PUBLIC_URL: "  " })).toEqual({ origin: null, problem: null });
  for (const url of ["https://g.example", "https://g.example/"])
    expect(publicOrigin({ GARNISH_PUBLIC_URL: url })).toEqual({ origin: "https://g.example", problem: null });
  expect(publicOrigin({ GARNISH_PUBLIC_URL: "http://localhost:9988" }).origin).toBe("http://localhost:9988");
});

const reached = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

test.each([
  ["the LAN address typed", reached("http://192.168.1.5:9988/api/mcp"), "http://192.168.1.5:9988"],
  ["localhost", reached("http://localhost:9988/api/mcp"), "http://localhost:9988"],
  [
    "a tunnel saying https",
    reached("http://localhost:9988/api/mcp", { host: "garnish.example.com", "x-forwarded-proto": "https" }),
    "https://garnish.example.com",
  ],
  [
    "a proxy naming the host",
    reached("http://10.0.0.2/api/mcp", { "x-forwarded-host": "g.example, inner", "x-forwarded-proto": "https,http" }),
    "https://g.example",
  ],
  ["https on its default port", reached("http://x/api/mcp", { host: "g.example:443", "x-forwarded-proto": "https" }), "https://g.example"],
  ["a host that is not a host", reached("http://localhost:9988/api/mcp", { host: "evil.example/path@x" }), "http://localhost:9988"],
  ["a protocol that is not one", reached("http://localhost:9988/api/mcp", { "x-forwarded-proto": "javascript" }), "http://localhost:9988"],
])("requestOrigin: %s", (_, request, origin) => {
  expect(requestOrigin(request)).toBe(origin);
});

test("mcpSettings: GARNISH_PUBLIC_URL when it is sound, else the origin the request reached", () => {
  const request = reached("http://192.168.1.5:9988/api/mcp");
  expect(mcpSettings(request, {})).toEqual({ issuer: "http://192.168.1.5:9988", resource: "http://192.168.1.5:9988/api/mcp" });
  expect(mcpSettings(request, { GARNISH_PUBLIC_URL: "https://g.example" })).toEqual({ issuer: "https://g.example", resource: "https://g.example/api/mcp" });
  expect(mcpSettings(request, { GARNISH_PUBLIC_URL: "nonsense" }).issuer).toBe("http://192.168.1.5:9988");
});

test("parseScope keeps known scopes in order, and nothing asked is everything", () => {
  expect(parseScope("delete read")).toEqual(["read", "delete"]);
  expect(parseScope("read admin")).toEqual(["read"]);
  expect(parseScope("admin")).toEqual([]);
  expect(parseScope("")).toEqual(["read", "write", "delete"]);
  expect(parseScope(undefined)).toEqual(["read", "write", "delete"]);
});

test("verifyPkce accepts the verifier its S256 challenge was made from, and nothing else", () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  expect(verifyPkce(verifier, challenge)).toBe(true);
  expect(verifyPkce(`${verifier}x`, challenge)).toBe(false);
  expect(verifyPkce("short", createHash("sha256").update("short").digest("base64url"))).toBe(false);
});

test("sameSecret compares whole strings", () => {
  expect(sameSecret(PASS, PASS)).toBe(true);
  expect(sameSecret("correct horse", PASS)).toBe(false);
  expect(sameSecret("", PASS)).toBe(false);
});

test("a pairing code reads in any case, without its dashes, and with O, I and L for 0 and 1", () => {
  expect(readPairingCode(" k7qf-m2xp 9rtd ")).toBe("K7QFM2XP9RTD");
  expect(samePairingCode("k7qf m2xp 9rtd", "K7QF-M2XP-9RTD")).toBe(true);
  expect(samePairingCode("1O0L-AAAA-BBBB", "1001-AAAA-BBBB")).toBe(true);
  expect(samePairingCode("K7QF-M2XP-9RTE", "K7QF-M2XP-9RTD")).toBe(false);
  expect(samePairingCode("", "K7QF-M2XP-9RTD")).toBe(false);
});

test.each([
  ["https://claude.ai/api/mcp/auth_callback", true],
  ["http://localhost:33418/callback", true],
  ["http://127.0.0.1/cb", true],
  ["http://evil.example/cb", false],
  ["javascript:alert(1)", false],
  ["https://claude.ai/cb#frag", false],
  ["not a url", false],
])("redirectAllowed(%j) is %j", (uri, expected) => {
  expect(redirectAllowed(uri)).toBe(expected);
});

test("redirectMatches is exact, except a loopback address may change its port", () => {
  const registered = ["https://claude.ai/api/mcp/auth_callback", "http://localhost:3000/callback"];
  expect(redirectMatches("https://claude.ai/api/mcp/auth_callback", registered)).toBe(true);
  expect(redirectMatches("https://claude.ai/api/mcp/auth_callback/", registered)).toBe(false);
  expect(redirectMatches("http://localhost:51234/callback", registered)).toBe(true);
  expect(redirectMatches("http://localhost:51234/other", registered)).toBe(false);
  expect(redirectMatches("https://evil.example/api/mcp/auth_callback", registered)).toBe(false);
});

test("a metadata client id is an https URL with a path", () => {
  expect(isMetadataClientId("https://claude.ai/oauth/mcp-oauth-client-metadata")).toBe(true);
  expect(isMetadataClientId("https://claude.ai/")).toBe(false);
  expect(isMetadataClientId("6f1e2b3c-0000-4000-8000-000000000000")).toBe(false);
  expect(isMetadataClientId("http://claude.ai/oauth/meta")).toBe(false);
});

test("clientFromDocument reads a document that names itself, and refuses one that does not", () => {
  const url = "https://claude.ai/oauth/mcp-oauth-client-metadata";
  const document = { client_id: url, client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] };
  expect(clientFromDocument(url, document)).toEqual({
    ok: true,
    client: { id: url, name: "Claude", redirectUris: document.redirect_uris, kind: "metadata", secretHash: null, host: "claude.ai" },
  });
  expect(clientFromDocument(url, { ...document, client_id: "https://evil.example/meta" })).toMatchObject({ ok: false });
  expect(clientFromDocument(url, { ...document, redirect_uris: ["http://evil.example/cb"] })).toMatchObject({ ok: false });
  expect(clientFromDocument(url, "nonsense")).toMatchObject({ ok: false });
});

test.each([
  ["10.0.0.5", true],
  ["192.168.1.20", true],
  ["172.20.0.1", true],
  ["127.0.0.1", true],
  ["169.254.169.254", true],
  ["100.100.1.1", true],
  ["::1", true],
  ["fd12::1", true],
  ["::ffff:192.168.1.1", true],
  ["160.79.104.10", false],
  ["2606:4700::1", false],
])("privateAddress(%j) is %j", (address, expected) => {
  expect(privateAddress(address)).toBe(expected);
});
