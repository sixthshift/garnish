-- A choice of food in one row (decisions.md row 198): the stir-fry's protein
-- is chicken thigh, or beef strips, or prawns. The row's own food is the
-- first option and the default; `ingredient_option` holds the others, each a
-- food with its own amount when it differs (400 g prawns against 500 g
-- chicken). An option with no quantity takes the row's amount and unit.
--
-- The option goes with its row, and with its food: an option of a food that
-- no longer exists is no option.

CREATE TABLE ingredient_option (
  id              TEXT PRIMARY KEY,
  ingredient_id   TEXT NOT NULL REFERENCES ingredient(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  food_id         TEXT NOT NULL REFERENCES food(id) ON DELETE CASCADE,
  quantity        REAL CHECK (quantity IS NULL OR quantity >= 0),
  unit_id         TEXT REFERENCES unit(id) ON DELETE SET NULL,
  UNIQUE (ingredient_id, position)
);

CREATE INDEX ingredient_option_food_id ON ingredient_option(food_id);
CREATE INDEX ingredient_option_unit_id ON ingredient_option(unit_id);

-- The plan chooses (row 198): which option each row of the entry's recipe
-- takes, as a JSON object of ingredient id to food id. A row not named, or
-- named with a food that is no longer one of its options, takes its own.
ALTER TABLE meal_plan_entry ADD COLUMN choices TEXT NOT NULL DEFAULT '{}';
