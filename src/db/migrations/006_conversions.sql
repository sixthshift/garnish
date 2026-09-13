-- Conversions per food (decisions.md row 69).
--
-- Read a row as "1 cup of plain flour is 125 g": `quantity` of `unit_id` of
-- this food equals `to_quantity` of `to_unit_id`. It hangs off the food, not
-- the unit, because the answer is a property of the ingredient — a cup of
-- flour is 125 g and a cup of sugar is 220 g, so a conversion stored on "cup"
-- could only ever be wrong for one of them.
--
-- `unit.standard_quantity` / `unit.standard_unit_id` stay as they are and keep
-- the unit-to-unit conversions that really are food-independent (a litre is
-- 1000 ml whatever is in it). The two are complementary, not competing:
-- M32.2's `convert` tries the food's rows first, then the unit's.
--
-- Both units cascade: a conversion naming a deleted unit is not a conversion,
-- so unlike an ingredient's `unit_id` (SET NULL, the amount survives without
-- its unit) there is nothing left to keep. Same for the food.
--
-- UNIQUE (food_id, unit_id, to_unit_id) so a food has one answer per direction;
-- the reverse direction is derived by `convert` rather than stored, but storing
-- it explicitly is still legal and is a different row.

CREATE TABLE food_conversion (
  id          TEXT PRIMARY KEY,
  food_id     TEXT NOT NULL REFERENCES food(id) ON DELETE CASCADE,
  unit_id     TEXT NOT NULL REFERENCES unit(id) ON DELETE CASCADE,
  quantity    REAL NOT NULL CHECK (quantity > 0),
  to_unit_id  TEXT NOT NULL REFERENCES unit(id) ON DELETE CASCADE,
  to_quantity REAL NOT NULL CHECK (to_quantity > 0),
  CHECK (unit_id <> to_unit_id),
  UNIQUE (food_id, unit_id, to_unit_id)
);

-- The food's rows are read together, and the two unit columns are the cascades.
CREATE INDEX food_conversion_food_id ON food_conversion(food_id);
CREATE INDEX food_conversion_unit_id ON food_conversion(unit_id);
CREATE INDEX food_conversion_to_unit_id ON food_conversion(to_unit_id);
