-- A cooking session (decisions.md row 214): what happened while a recipe was
-- cooked from its page — the servings and choices it began at, the
-- adjustments taken, the notes said and the conversation with the assistant.
-- One per recipe; a new Start cooking replaces it and the review's Save or a
-- discard deletes it. Held here rather than in the browser so a reload, a
-- second device and the review on a desktop see the same one.
--
-- The lists are JSON, read and written whole through the domain's zod
-- schemas (src/domain/recipes/cooking/session.ts): nothing queries inside them.
--
-- Not the household's data: a backup leaves it out and a restore leaves it.

CREATE TABLE cook_session (
  id          TEXT PRIMARY KEY,
  recipe_id   TEXT NOT NULL UNIQUE REFERENCES recipe(id) ON DELETE CASCADE,
  servings    REAL,
  choices     TEXT,
  adjustments TEXT NOT NULL DEFAULT '[]',
  notes       TEXT NOT NULL DEFAULT '[]',
  messages    TEXT NOT NULL DEFAULT '[]',
  started_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
