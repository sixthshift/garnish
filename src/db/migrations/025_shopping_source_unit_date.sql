-- A shopping line's source learns its unit and, when the meal plan put it
-- there, the plan's date (decisions.md row 182).
--
-- The list's meal view shows each dish its own share of a merged line: the
-- 200 g of the 350 g of butter that the tart asked for. `quantity` already
-- holds that share, but in the unit it arrived in, which a merge across
-- convertible units (a cup of flour into a gram line) does not keep; so the
-- unit is kept beside it. NULL is the line's own unit, which every source
-- written before this was in unless its merge converted.
--
-- `plan_date` is the entry's day, YYYY-MM-DD: what the meal view groups by
-- and orders by. `part_name` keeps the day's label ("Mon 26 Oct") for the
-- expansion, as before, but a label has no year and is not to be parsed back.

ALTER TABLE shopping_item_source ADD COLUMN unit_id TEXT REFERENCES unit(id) ON DELETE SET NULL;
ALTER TABLE shopping_item_source ADD COLUMN plan_date TEXT;
