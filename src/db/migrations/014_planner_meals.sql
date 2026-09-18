-- Meals are chosen per run (M39.7, stage 14).
--
-- 013 made "which meals do we plan?" a household setting: three rows, dinner
-- on, edited in Settings. It is not one. Which meals to plan is the same kind
-- of choice as which days -- the household's answer changes week to week, and
-- a default living in Settings was one more place to look before pressing
-- Propose. Both choices now sit on the proposal sheet and are remembered on
-- the device (`garnish.planner.meals`, beside `garnish.planner.days`), so the
-- database has nothing to say about them (decisions.md row 102).
--
-- The vocabulary does not change: `meal_plan_entry.meal` and the prompt still
-- name the same three meals, and `MEALS` in `src/domain/planner/` is still
-- where they are written down. Only the table goes.

DROP TABLE planner_meal;
