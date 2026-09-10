-- garnish initial schema. Tables and columns follow docs/architecture.md;
-- types, defaults and constraints follow Mealie where the doc is silent.
-- Ids are UUID text. Timestamps are ISO 8601 UTC text.
-- Recipe-owned rows (component, ingredient, step, recipe_note, recipe_tag)
-- cascade on recipe delete; reference lookups (food, unit, aisle) set null.

CREATE TABLE aisle (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL COLLATE NOCASE UNIQUE,
  position  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE unit (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL COLLATE NOCASE UNIQUE,
  plural_name        TEXT,
  abbreviation       TEXT NOT NULL DEFAULT '',
  use_abbreviation   INTEGER NOT NULL DEFAULT 0 CHECK (use_abbreviation IN (0, 1)),
  fraction           INTEGER NOT NULL DEFAULT 1 CHECK (fraction IN (0, 1)),
  standard_quantity  REAL,
  standard_unit_id   TEXT REFERENCES unit(id) ON DELETE SET NULL
);

CREATE INDEX unit_standard_unit_id ON unit(standard_unit_id);

CREATE TABLE recipe (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  image           TEXT,
  rating          REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  last_made       TEXT,
  servings        REAL NOT NULL DEFAULT 0,
  yield_quantity  REAL NOT NULL DEFAULT 0,
  yield_unit_id   TEXT REFERENCES unit(id) ON DELETE SET NULL,
  yield_text      TEXT NOT NULL DEFAULT '',
  prep_minutes    INTEGER,
  cook_minutes    INTEGER,
  source_url      TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX recipe_yield_unit_id ON recipe(yield_unit_id);

CREATE TABLE food (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL COLLATE NOCASE UNIQUE,
  plural_name    TEXT,
  aliases        TEXT NOT NULL DEFAULT '[]',  -- JSON array of strings
  aisle_id       TEXT REFERENCES aisle(id) ON DELETE SET NULL,
  recipe_id      TEXT REFERENCES recipe(id) ON DELETE SET NULL,  -- sub-recipe hook, behaviour deferred
  skip_shopping  INTEGER NOT NULL DEFAULT 0 CHECK (skip_shopping IN (0, 1))
);

CREATE INDEX food_aisle_id ON food(aisle_id);
CREATE INDEX food_recipe_id ON food(recipe_id);

CREATE TABLE recipe_note (
  id         TEXT PRIMARY KEY,
  recipe_id  TEXT NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  text       TEXT NOT NULL DEFAULT '',
  UNIQUE (recipe_id, position)
);

CREATE TABLE component (
  id         TEXT PRIMARY KEY,
  recipe_id  TEXT NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  name       TEXT NOT NULL DEFAULT '',  -- '' is the single unnamed component (flat recipe)
  UNIQUE (recipe_id, position)
);

CREATE TABLE ingredient (
  id             TEXT PRIMARY KEY,
  component_id   TEXT NOT NULL REFERENCES component(id) ON DELETE CASCADE,
  position       INTEGER NOT NULL,
  quantity       REAL,                -- NULL: no amount ("salt to taste")
  unit_id        TEXT REFERENCES unit(id) ON DELETE SET NULL,
  food_id        TEXT REFERENCES food(id) ON DELETE SET NULL,
  note           TEXT NOT NULL DEFAULT '',
  original_text  TEXT NOT NULL DEFAULT '',
  fixed          INTEGER NOT NULL DEFAULT 0 CHECK (fixed IN (0, 1)),  -- has an amount, does not scale
  UNIQUE (component_id, position)
);

CREATE INDEX ingredient_unit_id ON ingredient(unit_id);
CREATE INDEX ingredient_food_id ON ingredient(food_id);

CREATE TABLE step (
  id            TEXT PRIMARY KEY,
  recipe_id     TEXT NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
  component_id  TEXT REFERENCES component(id) ON DELETE SET NULL,
  position      INTEGER NOT NULL,
  text          TEXT NOT NULL DEFAULT '',
  UNIQUE (recipe_id, position)
);

CREATE INDEX step_component_id ON step(component_id);

CREATE TABLE tag (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL COLLATE NOCASE UNIQUE,
  slug  TEXT NOT NULL UNIQUE
);

CREATE TABLE recipe_tag (
  recipe_id  TEXT NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
  tag_id     TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, tag_id)
);

CREATE INDEX recipe_tag_tag_id ON recipe_tag(tag_id);
