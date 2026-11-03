-- Substitutes (decisions.md row 196): another way to make an ingredient when
-- the written one is missing. "Buttermilk can be milk and lemon".
--
-- A substitute has one owner. The food owns the ones true wherever it goes;
-- an ingredient row owns the ones only its recipe takes. Exactly one of
-- `food_id` and `ingredient_id` is set, and either cascades: a substitute
-- for a food or row that no longer exists is not a substitute.
--
-- `basis_quantity` of `basis_unit_id` is what the items replace: "per 1 cup
-- of buttermilk". NULL is "the same amount": a one-for-one swap. An item
-- with no quantity takes the row's own amount and unit.
--
-- A row with `substitutes_off` does not take its food's substitutes: oil
-- for butter holds in a sauté, not in pastry. Its own still apply.

CREATE TABLE substitute (
  id              TEXT PRIMARY KEY,
  food_id         TEXT REFERENCES food(id) ON DELETE CASCADE,
  ingredient_id   TEXT REFERENCES ingredient(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  basis_quantity  REAL CHECK (basis_quantity IS NULL OR basis_quantity > 0),
  basis_unit_id   TEXT REFERENCES unit(id) ON DELETE SET NULL,
  note            TEXT NOT NULL DEFAULT '',
  CHECK ((food_id IS NULL) <> (ingredient_id IS NULL))
);

CREATE INDEX substitute_food_id ON substitute(food_id);
CREATE INDEX substitute_ingredient_id ON substitute(ingredient_id);
CREATE INDEX substitute_basis_unit_id ON substitute(basis_unit_id);

-- What goes in the written food's place: one item, or several ("milk and
-- lemon"). The food cascades, and a substitute left with no items goes with
-- its last one, below.
CREATE TABLE substitute_item (
  id              TEXT PRIMARY KEY,
  substitute_id   TEXT NOT NULL REFERENCES substitute(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  food_id         TEXT NOT NULL REFERENCES food(id) ON DELETE CASCADE,
  quantity        REAL CHECK (quantity IS NULL OR quantity >= 0),
  unit_id         TEXT REFERENCES unit(id) ON DELETE SET NULL,
  UNIQUE (substitute_id, position)
);

CREATE INDEX substitute_item_food_id ON substitute_item(food_id);
CREATE INDEX substitute_item_unit_id ON substitute_item(unit_id);

-- Deleting a food takes the items made of it; a substitute with nothing left
-- to put in is no substitute, so it goes too.
CREATE TRIGGER substitute_item_last
AFTER DELETE ON substitute_item
WHEN NOT EXISTS (SELECT 1 FROM substitute_item WHERE substitute_id = OLD.substitute_id)
BEGIN
  DELETE FROM substitute WHERE id = OLD.substitute_id;
END;

ALTER TABLE ingredient ADD COLUMN substitutes_off INTEGER NOT NULL DEFAULT 0 CHECK (substitutes_off IN (0, 1));
