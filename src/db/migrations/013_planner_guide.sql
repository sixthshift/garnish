-- The planner guide, and the meals the week plans for (M39.2, stage 14).
--
-- 012 gave an entry its meal. This is the other half of what a proposal needs:
-- the household's own rules for what a good week looks like, and which meals
-- the week is planned for at all.
--
-- `planner_rule` is `style_rule`'s shape exactly, down to the column order,
-- because it is the same object: a short statement, on or off, in the order it
-- is read out to the model. Two tables rather than one with a `guide` column,
-- because the two guides are read, edited, seeded and reordered separately and
-- nothing ever wants both at once; a shared table would put a WHERE on every
-- query to buy nothing. What is shared is the seeding logic
-- (`src/db/seed/statements.ts`), which is where the duplication would have
-- cost something.
--
-- `planner_meal` is three rows, not a column somewhere: "which meals do we
-- plan?" is a household setting with no other home, and a row per meal keeps
-- the answer in the same vocabulary the entry's `meal` column and the prompt
-- use. Dinner on, breakfast and lunch off, which is what the week already
-- looks like -- most households plan dinner and eat breakfast without asking.
-- The meal is its own primary key: there is one row per meal, forever.
--
-- What is deliberately not here: the date, the hemisphere and the week's open
-- slots. Those are facts of a run, worked out when the proposal is asked for,
-- and are fixed lines of the prompt rather than statements anyone may switch
-- off -- the same split the restyle makes with its facts line.
--
-- Same conventions as 001_init.sql: UUID text ids, ISO 8601 UTC timestamps,
-- integer 0/1 booleans. `position` is not unique, because a reorder rewrites
-- every row in one transaction.

CREATE TABLE planner_rule (
  id         TEXT PRIMARY KEY,
  position   INTEGER NOT NULL,
  text       TEXT NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE planner_meal (
  meal    TEXT PRIMARY KEY CHECK (meal IN ('breakfast', 'lunch', 'dinner')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);

INSERT INTO planner_meal (meal, enabled) VALUES
  ('breakfast', 0),
  ('lunch', 0),
  ('dinner', 1);
