-- The household's staples are on hand (decisions.md row 175): salt and
-- pepper, white and caster sugar, the cooking oils and ice reach a shopping
-- list already ticked, as water and "salt and pepper" did from the seed. The
-- seed flags them for a new database; this flags them in one made before it.
-- By name, so a database without one of these foods is left alone.

UPDATE food SET skip_shopping = 1
WHERE name IN (
  'salt', 'black pepper', 'white pepper',
  'white sugar', 'caster sugar',
  'olive oil', 'extra virgin olive oil', 'vegetable oil', 'canola oil',
  'ice'
);
