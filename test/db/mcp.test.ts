// The OAuth server's memory (023_mcp.sql): clients, the grants made to them, and token hashes.
import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../src/db/connection/open";
import { migrate } from "../../src/db/migrations/migrate";
import { type McpRepository, mcpRepository, newPairingCode } from "../../src/db/models/mcp/repo";

let db: Database;
let repo: McpRepository;
beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  repo = mcpRepository(db);
});

const CALLBACK = "https://claude.ai/api/mcp/auth_callback";
const token = (grantId: string, hash: string, over: Partial<Parameters<McpRepository["storeToken"]>[0]> = {}) =>
  repo.storeToken({ hash, grantId, kind: "access", resource: "https://g.example/api/mcp", expiresAt: "2026-10-26T12:00:00.000Z", ...over });

test("a registered client gets a fresh id and keeps its redirect addresses as a list", () => {
  const client = repo.registerClient({ name: "Claude", redirectUris: [CALLBACK], secretHash: null });
  expect(client).toMatchObject({ name: "Claude", kind: "registered", redirectUris: [CALLBACK], secretHash: null });
  expect(repo.client(client.id)).toEqual(client);
  expect(repo.client("nope")).toBeNull();
});

test("a metadata client is kept by its URL, and saved again refreshes its name and addresses", () => {
  const url = "https://claude.ai/oauth/mcp-oauth-client-metadata";
  repo.saveMetadataClient({ id: url, name: "Claude", redirectUris: [CALLBACK] });
  repo.saveMetadataClient({ id: url, name: "Claude (new)", redirectUris: [CALLBACK, "https://claude.com/cb"] });
  expect(repo.client(url)).toMatchObject({ id: url, kind: "metadata", name: "Claude (new)", redirectUris: [CALLBACK, "https://claude.com/cb"] });
});

test("a token reads back with its grant and client; revoking the grant takes its tokens with it", () => {
  const client = repo.registerClient({ name: "Claude", redirectUris: [CALLBACK], secretHash: null });
  const grant = repo.createGrant(client.id, "read write");
  token(grant.id, "h1");
  token(grant.id, "h2", { kind: "refresh" });
  expect(repo.token("h1")).toMatchObject({ hash: "h1", kind: "access", grant: { id: grant.id, scope: "read write" }, client: { name: "Claude" } });
  expect(repo.revokeGrant(grant.id)).toBe(true);
  expect(repo.token("h1")).toBeNull();
  expect(repo.token("h2")).toBeNull();
  expect(repo.revokeGrant(grant.id)).toBe(false);
});

test("a refresh token is spent once", () => {
  const client = repo.registerClient({ name: "Claude", redirectUris: [CALLBACK], secretHash: null });
  const grant = repo.createGrant(client.id, "read");
  token(grant.id, "r1", { kind: "refresh" });
  expect(repo.spendToken("r1", "2026-10-26T10:00:00.000Z")).toBe(true);
  expect(repo.spendToken("r1", "2026-10-26T10:00:01.000Z")).toBe(false);
  expect(repo.token("r1")?.usedAt).toBe("2026-10-26T10:00:00.000Z");
});

test("connections list each grant with its client's name, the most recently used first", () => {
  const claude = repo.registerClient({ name: "Claude", redirectUris: [CALLBACK], secretHash: null });
  const code = repo.registerClient({ name: "Claude Code", redirectUris: ["http://localhost:3000/cb"], secretHash: null });
  const first = repo.createGrant(claude.id, "read");
  const second = repo.createGrant(code.id, "read write delete");
  repo.touchGrant(first.id, "2099-01-01T00:00:00.000Z");
  expect(repo.connections().map((row) => [row.id, row.clientName, row.scope])).toEqual([
    [first.id, "Claude", "read"],
    [second.id, "Claude Code", "read write delete"],
  ]);
});

test("the pairing code is made on first asking, then stays until it is replaced", () => {
  const code = repo.pairingCode();
  expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  expect(repo.pairingCode()).toBe(code);
  const next = repo.replacePairingCode();
  expect(next).not.toBe(code);
  expect(repo.pairingCode()).toBe(next);
});

test("replacing the pairing code from a stale one fails, so two Allows on one code cannot both spend it", () => {
  const code = repo.pairingCode();
  const winner = repo.replacePairingCode(code);
  expect(winner).not.toBeNull();
  expect(repo.replacePairingCode(code)).toBeNull();
  expect(repo.pairingCode()).toBe(winner);
});

test("newPairingCode is fresh every time", () => {
  expect(new Set(Array.from({ length: 50 }, newPairingCode)).size).toBe(50);
});

test("sweep drops expired tokens and clients nobody let in, and keeps the rest", () => {
  const kept = repo.registerClient({ name: "Kept", redirectUris: [CALLBACK], secretHash: null });
  const grant = repo.createGrant(kept.id, "read");
  token(grant.id, "old", { expiresAt: "2026-10-25T00:00:00.000Z" });
  token(grant.id, "live", { expiresAt: "2026-10-27T00:00:00.000Z" });
  const abandoned = repo.registerClient({ name: "Abandoned", redirectUris: [CALLBACK], secretHash: null });
  repo.sweep("2026-10-26T00:00:00.000Z", "2999-01-01T00:00:00.000Z");
  expect(repo.token("old")).toBeNull();
  expect(repo.token("live")).not.toBeNull();
  expect(repo.client(kept.id)).not.toBeNull();
  expect(repo.client(abandoned.id)).toBeNull();
});
