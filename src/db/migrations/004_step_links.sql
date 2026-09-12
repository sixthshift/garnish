-- Steps link ingredients (decisions.md row 64).
--
-- Ownership is still the tree: an ingredient row lives in exactly one part, and
-- that is what says how much to buy and what the prep list shows. A link is not
-- ownership. A step may name any ingredient of its own part, and one ingredient
-- may be named by several steps of that part — butter lives in the pastry and is
-- used in pastry step 1 and pastry step 4.
--
-- The pair is the primary key, so a step names a row at most once. `position`
-- is the order the document listed the links in, so a read gives them back the
-- way the editor arranged them.
--
-- "Same part only" is not something a foreign key can say, so the repository
-- enforces it on write: a link naming an ingredient outside the step's own part
-- is dropped rather than failing the save. Both sides cascade, so a link goes
-- with whichever of its two rows is deleted first.

CREATE TABLE step_ingredient (
  step_id        TEXT NOT NULL REFERENCES step(id) ON DELETE CASCADE,
  ingredient_id  TEXT NOT NULL REFERENCES ingredient(id) ON DELETE CASCADE,
  position       INTEGER NOT NULL,
  PRIMARY KEY (step_id, ingredient_id)
);

-- The step_id side is covered by the primary key; this is the ingredient side,
-- for "which steps use this row" and for the cascade when a row is deleted.
CREATE INDEX step_ingredient_ingredient_id ON step_ingredient(ingredient_id);
