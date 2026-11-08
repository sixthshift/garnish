-- Which part of the week a recipe fits is a facet like the others, the layer
-- `week` with the values 'weeknight' and 'weekend' (decisions.md row 219,
-- folding in row 191's `kind`): a set, so a recipe can fit both. SQLite cannot
-- widen a CHECK in place, so recipe_facet is rebuilt; each recipe's kind is
-- carried across, 'rotation' becoming 'weeknight', and the column goes.

CREATE TABLE recipe_facet_new (
  recipe_id  TEXT NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
  layer      TEXT NOT NULL CHECK (layer IN ('course', 'meal', 'week', 'cuisine', 'diet', 'main_ingredient', 'method', 'season')),
  value      TEXT NOT NULL,
  PRIMARY KEY (recipe_id, layer, value)
);

INSERT INTO recipe_facet_new (recipe_id, layer, value) SELECT recipe_id, layer, value FROM recipe_facet;

INSERT INTO recipe_facet_new (recipe_id, layer, value)
  SELECT id, 'week', CASE kind WHEN 'rotation' THEN 'weeknight' ELSE 'weekend' END FROM recipe WHERE kind IS NOT NULL;

DROP TABLE recipe_facet;

ALTER TABLE recipe_facet_new RENAME TO recipe_facet;

CREATE INDEX recipe_facet_layer_value ON recipe_facet(layer, value);

ALTER TABLE recipe DROP COLUMN kind;
