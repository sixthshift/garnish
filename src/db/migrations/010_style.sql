-- The house style guide (M37.2, decisions.md row 78, stage 13).
--
-- Every site writes its steps differently, and the import keeps the author's
-- words on purpose -- stage 12's check rejects any changed line. So the
-- household's own voice is a second, separate pass, and this table is what
-- that pass is told: a list of short statements ("One action per step: split a
-- paragraph that does several things."), each on or off, in the order they are
-- read to the model.
--
-- Statements rather than a paragraph of prose, because a list can be shown as
-- checkboxes in the restyle sheet, ticked per run, and tested one line at a
-- time; a paragraph can only be edited and hoped over. `text` is the whole
-- instruction sentence, since the text is exactly what goes to the model --
-- nothing here is a key the code switches on.
--
-- `enabled` is the default for a run, not a lock: the sheet starts from it and
-- the household may tick anything on or off for that recipe. Seeded with
-- fourteen statements, the first ten on and the last four off, matched by text
-- case-insensitively on re-seed so an edited row is never duplicated
-- (src/db/seed/style.ts).
--
-- Same conventions as 001_init.sql: UUID text ids, ISO 8601 UTC timestamps,
-- integer 0/1 booleans. `position` is the guide's order; like `shopping_item`'s
-- it is not unique, because a reorder rewrites every row in one transaction and
-- a unique index would make the intermediate states illegal. `text` is not
-- unique either: two statements may legitimately read alike, and the seed's
-- case-insensitive match is a rule about the seed, not about the table.

CREATE TABLE style_rule (
  id         TEXT PRIMARY KEY,
  position   INTEGER NOT NULL,
  text       TEXT NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
