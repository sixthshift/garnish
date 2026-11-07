-- What a recipe is, layer by layer (decisions.md row 209): its course, the
-- meals it suits, its cuisine, the diets it keeps to, its main ingredient,
-- how it is cooked and its season. One row a value; a layer with no rows is
-- not said. The values are the app's fixed lists (src/domain/recipes/recipe/
-- facets.ts), checked there rather than here so a list can grow without a
-- table rebuild; the layer is checked here, since a new layer is a new row in
-- decisions.md anyway.

CREATE TABLE recipe_facet (
  recipe_id  TEXT NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
  layer      TEXT NOT NULL CHECK (layer IN ('course', 'meal', 'cuisine', 'diet', 'main_ingredient', 'method', 'season')),
  value      TEXT NOT NULL,
  PRIMARY KEY (recipe_id, layer, value)
);

-- The library's filters ask "which recipes have this value": by value first.
CREATE INDEX recipe_facet_layer_value ON recipe_facet(layer, value);
