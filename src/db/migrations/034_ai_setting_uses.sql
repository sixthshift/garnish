-- Every use's model is chosen in Settings › AI now, not only the cooking
-- assistant's, and Settings is the only place a model is set: the model
-- variables are gone, and so are the default models (decisions.md row 217):
-- a use with no row has no model, and says so when asked. The choices are the household's now, so a backup
-- carries them and a restore replaces them, unlike 033's. SQLite cannot widen
-- a CHECK in place, so the table is rebuilt and the cooking assistant's choice
-- carried across.

CREATE TABLE ai_setting_new (
  use        TEXT PRIMARY KEY CHECK (use IN ('import', 'restyle', 'planner', 'cook')),
  model      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO ai_setting_new (use, model, updated_at) SELECT use, model, updated_at FROM ai_setting;

DROP TABLE ai_setting;

ALTER TABLE ai_setting_new RENAME TO ai_setting;
