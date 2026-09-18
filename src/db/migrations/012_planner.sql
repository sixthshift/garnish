-- A meal on a plan entry (M39.1, stage 14; decisions.md row 100).
--
-- 007_plan.sql argued days rather than meals, and for a week filled by hand
-- that still holds: a day holds as many entries as it holds, in `position`
-- order, and most of them are dinner. Stage 14's proposal is what changes the
-- argument. The model is asked to fill the open slots of a week, and a slot
-- has to be a fact before it can be open or filled -- "Tuesday's second entry"
-- is not something a proposal, a check or a review can talk about, while
-- "Tuesday lunch" is. So an entry may now name its meal.
--
-- Nullable, and NULL by default, which is what keeps row 71's default: a
-- hand-typed line lands with no meal, exactly as it always did, and the week
-- strip is still seven days rather than seven days by three slots. A meal is a
-- label an entry may carry, never a slot the page draws empty.
--
-- Three values, checked in the column: Mealie's `entry_type` minus `side`. A
-- side or a snack is an untyped entry here -- `side` is a kind of dish rather
-- than a time of day, and mixing the two axes in one column is what would make
-- "what is on Tuesday lunch" ambiguous again.
--
-- `position` stays the only order within a day. The meal does not sort, and
-- nothing derives order from it: a proposal appends its entries in meal order
-- and drag is unchanged.

ALTER TABLE meal_plan_entry ADD COLUMN meal TEXT CHECK (meal IN ('breakfast', 'lunch', 'dinner'));

-- The proposal's read: one week's open slots, day by day and meal by meal.
CREATE INDEX meal_plan_entry_date_meal ON meal_plan_entry(date, meal);
