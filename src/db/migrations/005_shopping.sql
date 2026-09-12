-- The shopping list (decisions.md row 67).
--
-- One list for the household: no owner column, no list table, no "which list" —
-- there is exactly one, the way there is exactly one recipe collection. Mealie
-- has many lists because it has many users and groups; garnish has neither
-- (CLAUDE.md, no auth), so a list id would be a column that only ever held one
-- value.
--
-- A line is either a food line (`food_id` set, with an optional `unit_id` and
-- `quantity`) or a free-text line (`text`, "batteries"). Both shapes live in one
-- table, as Mealie's `shopping_list_item` does: a line typed as text at the
-- supermarket is the same row as a line that came off a recipe, and merging
-- (M31.2) is what tells them apart.
--
-- `shopping_item_source` is Mealie's `recipeReferences`, denormalised on
-- purpose. A line remembers where it came from — the recipe, the part, the
-- servings it was added at, and the quantity that recipe contributed — and
-- `recipe_name` and `part_name` are copied rather than joined so the answer
-- survives the recipe being deleted or renamed. `recipe_id` is the live link
-- while it lasts (SET NULL when the recipe goes), so an expanded line can still
-- offer "open the recipe" when there is one to open.
--
-- Same conventions as 001_init.sql: UUID text ids, ISO 8601 UTC timestamps,
-- integer 0/1 booleans, reference lookups setting null, owned rows cascading.
-- `position` is the drag order over the whole list; it is not unique, because a
-- reorder rewrites every row in one transaction and a unique index would make
-- the intermediate states illegal.

CREATE TABLE shopping_item (
  id         TEXT PRIMARY KEY,
  position   INTEGER NOT NULL,
  food_id    TEXT REFERENCES food(id) ON DELETE SET NULL,
  unit_id    TEXT REFERENCES unit(id) ON DELETE SET NULL,
  quantity   REAL,
  text       TEXT NOT NULL DEFAULT '',
  ticked     INTEGER NOT NULL DEFAULT 0 CHECK (ticked IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- The two reference columns, for the SET NULL when a food or unit is deleted
-- and for "is this food on the list".
CREATE INDEX shopping_item_food_id ON shopping_item(food_id);
CREATE INDEX shopping_item_unit_id ON shopping_item(unit_id);

CREATE TABLE shopping_item_source (
  id          TEXT PRIMARY KEY,
  item_id     TEXT NOT NULL REFERENCES shopping_item(id) ON DELETE CASCADE,
  recipe_id   TEXT REFERENCES recipe(id) ON DELETE SET NULL,
  recipe_name TEXT NOT NULL DEFAULT '',
  part_name   TEXT NOT NULL DEFAULT '',
  servings    REAL,
  quantity    REAL
);

CREATE INDEX shopping_item_source_item_id ON shopping_item_source(item_id);
CREATE INDEX shopping_item_source_recipe_id ON shopping_item_source(recipe_id);
