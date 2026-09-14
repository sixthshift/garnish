-- Keeping the original steps through a restyle (M37.5, stage 13).
--
-- The restyle rewrites a part's steps in the household's voice. The words it
-- replaces are the author's, and they are the one thing that cannot be
-- reconstructed afterwards -- the facts survive by the check (M37.3), the
-- phrasing does not -- so the first restyle of a part copies its steps aside
-- before overwriting them, and a restyle can then be undone, or redone from
-- the original rather than from a rewrite of a rewrite.
--
-- `part.source_steps` is a JSON array of the step texts in position order,
-- NULL until the first restyle. Written once and only once: a second restyle
-- finds it already set and leaves it alone, which is what makes "the original"
-- mean the author's words rather than whatever the last pass produced.
-- Restoring puts them back and sets the column to NULL again, so NULL always
-- reads as "these steps are the ones the recipe came with".
--
-- JSON in a column rather than a `source_step` table, because nothing ever
-- queries into it: it is written whole, read whole, and has no order, links or
-- images of its own to model. Step ids and step photos are deliberately not
-- kept -- a restored step is a new row with a new id, and a photo attached to a
-- step that a rewrite replaced is gone. `food.aliases` (001_init.sql) already
-- stores a JSON array the same way.
--
-- `recipe.restyled_at` is the ISO 8601 UTC stamp of the last restyle, NULL when
-- the recipe still reads in its author's voice. It is the recipe page's quiet
-- "Restyled" note, and it is cleared by a restore. It sits on the recipe rather
-- than being derived from the parts because a restyle is one act over the whole
-- recipe, and because "when" is a fact the parts do not carry.

ALTER TABLE part ADD COLUMN source_steps TEXT;

ALTER TABLE recipe ADD COLUMN restyled_at TEXT;
