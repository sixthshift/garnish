-- The MCP door: the OAuth 2.1 state behind /api/mcp (decisions.md row 181).
--
-- garnish has no users, and still has none: what these tables remember is
-- which *clients* the household let in, and the keys each one holds. A
-- client is Claude (claude.ai, the phone app, Claude Code) or any other MCP
-- client; it gets in by someone with the pairing code (024_mcp_pairing.sql) pressing Allow on the
-- consent page, and Settings › MCP lists what was let in and disconnects it.
--
-- `oauth_client` is a client that introduced itself. `id` is its client_id:
-- a UUID garnish made for one that registered (RFC 7591), or the https URL of
-- its metadata document for one that did not need to (Client ID Metadata
-- Documents, which claude.ai uses). `redirect_uris` is a JSON array; the
-- consent page only ever sends a browser back to one of them. A confidential
-- client's secret is kept only as a SHA-256 hash.
--
-- `oauth_grant` is one Allow: a client and the scopes it was given. It is
-- what Settings shows as a connection, and deleting it is Disconnect: its
-- tokens cascade with it.
--
-- `oauth_token` is a key or a renewal slip under a grant, stored as the
-- SHA-256 of the token so a copy of the database holds no usable key.
-- `resource` is the MCP endpoint the token was issued for (RFC 8707), checked
-- on every request. A refresh token is used once: `used_at` marks it spent,
-- and a spent one presented again after a short grace revokes its grant.
--
-- None of this is the household's data: a backup leaves it out and a restore
-- leaves it as it is, as with the push tables.
--
-- Same conventions as 001_init.sql: ISO 8601 UTC timestamps.

CREATE TABLE oauth_client (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('registered', 'metadata')),
  redirect_uris TEXT NOT NULL DEFAULT '[]',
  secret_hash   TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE oauth_grant (
  id           TEXT PRIMARY KEY,
  client_id    TEXT NOT NULL REFERENCES oauth_client(id) ON DELETE CASCADE,
  scope        TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at TEXT
);

CREATE TABLE oauth_token (
  hash       TEXT PRIMARY KEY,
  grant_id   TEXT NOT NULL REFERENCES oauth_grant(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('access', 'refresh')),
  resource   TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX oauth_token_grant ON oauth_token (grant_id);
