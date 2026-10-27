-- The sizes a food is sold in (decisions.md row 184): "butter comes in 250 g
-- and 500 g", "an egg comes in 6 and 12". The shopping list keeps the exact
-- amount the recipes need and, drawing a line, rounds it up to whole packs:
-- "400 g butter → 2 × 250 g".
--
-- One row per size. `unit_id` NULL is "each": a size counted in the food
-- itself (6 eggs, 1 lemon). The unit cascades, as a conversion's does: a size
-- in a deleted unit is no size at all. The amount must be above zero.
--
-- Not on the food document: only the list and the food's editor read them,
-- and the food is nested in every recipe and plan entry.

CREATE TABLE food_pack (
  id        TEXT PRIMARY KEY,
  food_id   TEXT NOT NULL REFERENCES food(id) ON DELETE CASCADE,
  quantity  REAL NOT NULL CHECK (quantity > 0),
  unit_id   TEXT REFERENCES unit(id) ON DELETE CASCADE
);

CREATE INDEX food_pack_food_id ON food_pack(food_id);
CREATE INDEX food_pack_unit_id ON food_pack(unit_id);
