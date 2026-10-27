-- The MCP pairing code (decisions.md row 181): what the consent page asks for
-- before it lets a client in, in place of a passphrase set in the environment.
--
-- One row, made the first time anything asks for it, so there is nothing to
-- set up. Settings › MCP shows it (hidden until asked) with Copy and
-- Regenerate, and every Allow replaces it, so a code that has been typed is
-- never good twice. Kept as itself, not a hash, since Settings shows it; a
-- copy of the database is the household's whole data anyway.
--
-- Not the household's data: like the OAuth tables, a backup leaves it out and
-- a restore leaves it as it is.

CREATE TABLE mcp_pairing (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  code       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
