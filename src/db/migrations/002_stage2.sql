-- Stage 2 additions: favourites and the "Made this" timeline (decisions 41, 43).
-- Same conventions as 001_init.sql: UUID text ids, ISO 8601 UTC timestamps,
-- recipe-owned rows cascade on recipe delete.

ALTER TABLE recipe ADD COLUMN favourite INTEGER NOT NULL DEFAULT 0 CHECK (favourite IN (0, 1));

-- One logged cook. `occurred_on` is a calendar date (YYYY-MM-DD), not a
-- timestamp: the cook happened on a day, and recipe.last_made is derived from
-- the greatest of these. `image` is a file name under data/images/timeline/.
CREATE TABLE timeline_event (
  id           TEXT PRIMARY KEY,
  recipe_id    TEXT NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
  occurred_on  TEXT NOT NULL CHECK (occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  message      TEXT NOT NULL DEFAULT '',
  image        TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX timeline_event_recipe_id ON timeline_event(recipe_id, occurred_on DESC);
