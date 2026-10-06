-- A unit that cuts one item rather than measuring an amount.
--
-- The food beside a unit agrees with it in number. A measure takes the plural
-- whatever the amount: "1 cup blueberries", "1 can chickpeas", "1 bunch
-- spring onions". A portion unit is a piece of a single item, so the food
-- stays singular however many there are: "2 slices lemon", "3 pieces pork
-- belly". Mealie has no such flag; it pluralises the food from the quantity
-- alone, which reads "1 cup blueberry" and "2 slices lemons".
--
-- Default 0: every unit but the two portions in the default set is a measure.
-- Units are seeded by name and never rewritten, so the existing slice and
-- piece are flagged here.

ALTER TABLE unit ADD COLUMN portion INTEGER NOT NULL DEFAULT 0 CHECK (portion IN (0, 1));

UPDATE unit SET portion = 1 WHERE name IN ('slice', 'piece');
