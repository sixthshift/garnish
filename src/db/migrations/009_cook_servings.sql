-- Servings on a cook (M35.2, stage 11's small parity items).
--
-- A logged cook can carry the number of servings it was made at: the Made
-- this sheet gains a servings stepper defaulting to the page's current
-- scale, the same control `PlanPopover` already offers when planning a day
-- (M33.4, `src/components/ui/NumberStepper.tsx`). NULL is "not recorded" --
-- every event logged before this column existed, and any future one nobody
-- bothers to adjust -- and the History row only prints "serves N" when a
-- number is actually there (`servingsLabel`, src/domain/plan.ts, reused
-- rather than duplicated). Same nullable REAL shape as
-- `meal_plan_entry.servings` (007_plan.sql) and for the same reason: a
-- stored number is a fact about that one cook, not a default standing in
-- for one.

ALTER TABLE timeline_event ADD COLUMN servings REAL;
