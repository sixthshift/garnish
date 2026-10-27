import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nowUtc } from "../columns";

/** A client that introduced itself to the OAuth server (023_mcp.sql): an MCP client, Claude or any other. */
export const oauthClient = sqliteTable(
  "oauth_client",
  {
    /** The client_id: a UUID for a registered client, the metadata document's URL for one that brought its own. */
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["registered", "metadata"] }).notNull(),
    /** JSON array of the addresses the consent page may send a browser back to. */
    redirectUris: text("redirect_uris", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** SHA-256 of a confidential client's secret; null for a public client. */
    secretHash: text("secret_hash"),
    createdAt: text("created_at").notNull().default(nowUtc),
  },
  (t) => [check("oauth_client_kind", sql`${t.kind} IN ('registered', 'metadata')`)]
);

/** One Allow on the consent page: what Settings lists as a connection, and what Disconnect deletes. */
export const oauthGrant = sqliteTable("oauth_grant", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClient.id, { onDelete: "cascade" }),
  /** Space-separated scopes, as OAuth writes them. */
  scope: text("scope").notNull(),
  createdAt: text("created_at").notNull().default(nowUtc),
  lastUsedAt: text("last_used_at"),
});

/** An access or refresh token under a grant, kept only as its SHA-256. */
export const oauthToken = sqliteTable(
  "oauth_token",
  {
    hash: text("hash").primaryKey(),
    grantId: text("grant_id")
      .notNull()
      .references(() => oauthGrant.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["access", "refresh"] }).notNull(),
    /** The MCP endpoint the token is for (RFC 8707). */
    resource: text("resource").notNull(),
    expiresAt: text("expires_at").notNull(),
    /** When a refresh token was spent; null while it is good. */
    usedAt: text("used_at"),
    createdAt: text("created_at").notNull().default(nowUtc),
  },
  (t) => [index("oauth_token_grant").on(t.grantId), check("oauth_token_kind", sql`${t.kind} IN ('access', 'refresh')`)]
);

/** The pairing code the consent page asks for (024_mcp_pairing.sql): one row, replaced on every Allow. */
export const mcpPairing = sqliteTable("mcp_pairing", {
  id: integer("id").primaryKey(),
  code: text("code").notNull(),
  createdAt: text("created_at").notNull().default(nowUtc),
});
