-- The author's recipe is kept whole, not part by part (decisions.md row 226).
--
-- A restyle may now rebuild a recipe's parts -- split one by what is made, fold
-- a heading like "choose ONE" into the main body, gather what is served into
-- "To serve" -- and move an ingredient row from one part to another. A copy of
-- each part kept on that part (017_source_part.sql) cannot undo that: the part
-- may be gone, and a row may sit in a part it never had. `recipe.source_parts`
-- keeps the recipe's parts as the author left them, in order:
--
--   [ { "name": "", "rows": ["<ingredient id>", ...], "notes": [""],
--       "steps": [ { "title": "", "text": "...", "summary": "" } ] } ]
--
-- `rows` are the ingredient rows' ids in that part's order and `notes` one per
-- row, so a restore can put every row back in its part with its note. Written
-- once on the first restyle and cleared by a restore, as source_part was, so
-- NULL still reads as "these are the parts the recipe came with".
--
-- The backfill takes every recipe with a part already restyled: each part's
-- kept steps and notes where it has them, its current ones (still the
-- author's) where it does not, and its rows as they stand, since nothing before
-- this migration could move one.

ALTER TABLE recipe ADD COLUMN source_parts TEXT;

UPDATE recipe
SET source_parts = (
  SELECT json_group_array(json_object(
    'name', p.name,
    'rows', (SELECT json_group_array(i.id) FROM (SELECT id FROM ingredient WHERE part_id = p.id ORDER BY position) i),
    'notes', json(coalesce(
      json_extract(p.source_part, '$.notes'),
      (SELECT json_group_array(i.note) FROM (SELECT note FROM ingredient WHERE part_id = p.id ORDER BY position) i)
    )),
    'steps', json(coalesce(
      json_extract(p.source_part, '$.steps'),
      (SELECT json_group_array(json_object('title', s.title, 'text', s.text, 'summary', s.summary))
       FROM (SELECT title, text, summary FROM step WHERE part_id = p.id ORDER BY position) s)
    ))
  ))
  FROM (SELECT * FROM part WHERE part.recipe_id = recipe.id ORDER BY position) p
)
WHERE EXISTS (SELECT 1 FROM part WHERE part.recipe_id = recipe.id AND part.source_part IS NOT NULL);

ALTER TABLE part DROP COLUMN source_part;
