-- Alternatives (decisions.md row 199): a line's options (row 198) and its
-- substitutes (row 196) are one thing, "you can use this instead", and they
-- belong to the line only. A food no longer has substitutes of its own.
--
-- An alternative is one or more foods with amounts ("1 cup milk and 1 tbsp
-- lemon juice"), measured against an optional basis ("per 1 cup"; none is a
-- one-for-one swap, and an item with no amount takes the line's), with a note.
-- `plan_picks` marks the ones the plan rotates through (the stir-fry's
-- protein); those are a single food, which is what a plan entry's choice
-- names. The rest are there to use instead, chosen by whoever is cooking.

CREATE TABLE alternative (
  id              TEXT PRIMARY KEY,
  ingredient_id   TEXT NOT NULL REFERENCES ingredient(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  basis_quantity  REAL CHECK (basis_quantity IS NULL OR basis_quantity > 0),
  basis_unit_id   TEXT REFERENCES unit(id) ON DELETE SET NULL,
  note            TEXT NOT NULL DEFAULT '',
  plan_picks      INTEGER NOT NULL DEFAULT 0 CHECK (plan_picks IN (0, 1))
);

CREATE INDEX alternative_ingredient_id ON alternative(ingredient_id);
CREATE INDEX alternative_basis_unit_id ON alternative(basis_unit_id);

CREATE TABLE alternative_item (
  id              TEXT PRIMARY KEY,
  alternative_id  TEXT NOT NULL REFERENCES alternative(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  food_id         TEXT NOT NULL REFERENCES food(id) ON DELETE CASCADE,
  quantity        REAL CHECK (quantity IS NULL OR quantity >= 0),
  unit_id         TEXT REFERENCES unit(id) ON DELETE SET NULL,
  UNIQUE (alternative_id, position)
);

CREATE INDEX alternative_item_food_id ON alternative_item(food_id);
CREATE INDEX alternative_item_unit_id ON alternative_item(unit_id);

-- Deleting a food takes the items made of it; an alternative with nothing
-- left to put in is no alternative, so it goes too.
CREATE TRIGGER alternative_item_last
AFTER DELETE ON alternative_item
WHEN NOT EXISTS (SELECT 1 FROM alternative_item WHERE alternative_id = OLD.alternative_id)
BEGIN
  DELETE FROM alternative WHERE id = OLD.alternative_id;
END;

-- A line's options come across first, ticked for the plan, each a single
-- food keeping its own amount; the line's substitutes follow, unticked. A
-- plan entry's choice named an option's food, which is still the item's.
INSERT INTO alternative (id, ingredient_id, position, basis_quantity, basis_unit_id, note, plan_picks)
SELECT id, ingredient_id, position, NULL, NULL, '', 1 FROM ingredient_option;

INSERT INTO alternative_item (id, alternative_id, position, food_id, quantity, unit_id)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-'
    || substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  id, 0, food_id, quantity, unit_id
FROM ingredient_option;

INSERT INTO alternative (id, ingredient_id, position, basis_quantity, basis_unit_id, note, plan_picks)
SELECT id, ingredient_id, 1000 + position, basis_quantity, basis_unit_id, note, 0 FROM substitute WHERE ingredient_id IS NOT NULL;

INSERT INTO alternative_item (id, alternative_id, position, food_id, quantity, unit_id)
SELECT item.id, item.substitute_id, item.position, item.food_id, item.quantity, item.unit_id
FROM substitute_item AS item
JOIN substitute ON substitute.id = item.substitute_id
WHERE substitute.ingredient_id IS NOT NULL;

-- A food's own substitutes go: the line is the only owner now.
DROP TABLE substitute_item;
DROP TABLE substitute;
DROP TABLE ingredient_option;
ALTER TABLE ingredient DROP COLUMN substitutes_off;
