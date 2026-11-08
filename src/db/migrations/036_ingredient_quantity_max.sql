-- An amount may be a range (decisions.md row 220): "5–6 tbsp", "1–2 limes",
-- "600–750 g chicken". `quantity` stays the lower bound and `quantity_max` is
-- the upper; NULL is no range, which is every row written before this. A range
-- has a lower bound below it. Mealie has no range; the recipe's internals are
-- garnish's own.

ALTER TABLE ingredient ADD COLUMN quantity_max REAL
  CHECK (quantity_max IS NULL OR (quantity IS NOT NULL AND quantity_max > quantity));
