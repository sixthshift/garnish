-- A model chosen in Settings › AI for a use (decisions.md row 215): the
-- cooking assistant's alone for now, so a chat model can be tried by feel
-- without editing the server's environment. A use with no row asks its
-- environment variable, then the provider's default; "Default" deletes the row.
--
-- Not the household's data but the server's configuration, as the AI
-- variables are: a backup leaves it out and a restore leaves it as it is.

CREATE TABLE ai_setting (
  use        TEXT PRIMARY KEY CHECK (use IN ('cook')),
  model      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
