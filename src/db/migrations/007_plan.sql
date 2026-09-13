-- The meal plan (decisions.md row 71).
--
-- One plan for the household, the way there is one shopping list (row 67): no
-- owner, no plan table, no plan id in any signature. A plan is nothing but the
-- entries on its days, so the day is the only key it needs.
--
-- Days, not meals. Mealie hangs a `entry_type` (breakfast / lunch / dinner /
-- side) off every entry and draws a grid of meal slots; garnish plans "what are
-- we eating on Thursday" and lets the day hold as many entries as it holds, in
-- `position` order. A meal type is a column that would be set to "dinner" on
-- every row here, and a week strip that is seven days rather than seven days by
-- four slots is the shape a phone can actually draw.
--
-- An entry is either a recipe entry (`recipe_id` set, with an optional
-- `servings` overriding the recipe's own) or a plain line ("leftovers",
-- "out"), exactly as a shopping line is a food line or a free-text line. One
-- table holds both, as Mealie's `group_meal_plan` does with its `recipe_id` and
-- `title`/`text` pair.
--
-- `recipe_id` sets null rather than cascading: deleting a recipe must not
-- silently empty a planned day, and the row is still a fact about that day.
-- Such an entry reads back as a plain line with whatever `text` it carries.
--
-- Same conventions as 001_init.sql: UUID text ids, calendar dates as
-- `YYYY-MM-DD` text with the same GLOB check `timeline_event.occurred_on`
-- carries. `position` is the order *within a day* and is not unique, because a
-- move rewrites a day's rows in one transaction and a unique index would make
-- the intermediate states illegal.

CREATE TABLE meal_plan_entry (
  id        TEXT PRIMARY KEY,
  date      TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  position  INTEGER NOT NULL,
  recipe_id TEXT REFERENCES recipe(id) ON DELETE SET NULL,
  text      TEXT NOT NULL DEFAULT '',
  servings  REAL
);

-- Every read is a week: a range over `date`, then `position` within the day.
CREATE INDEX meal_plan_entry_date ON meal_plan_entry(date, position);

-- The reference column, for the SET NULL when a recipe is deleted and for
-- "is this recipe planned".
CREATE INDEX meal_plan_entry_recipe_id ON meal_plan_entry(recipe_id);
