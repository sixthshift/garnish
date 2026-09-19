-- Keeping the whole of a part through a restyle, not only its step texts.
--
-- 011_restyle.sql kept `part.source_steps`, a JSON array of step texts, because
-- a restyle rewrote step text and nothing else. It now writes a step's label
-- and supporting line (016_step_fields.sql) and an ingredient row's note, so an
-- array of texts can no longer undo one: restoring would put the author's
-- sentences back and leave the labels, the supporting lines and the notes the
-- pass invented sitting beside them.
--
-- `part.source_part` replaces it with the part as the author left it:
--
--   { "steps": [ { "title": "", "text": "...", "summary": "" } ], "notes": [ "" ] }
--
-- `notes` is one per ingredient row in the part's own order, the same shape the
-- pass answers in. Written once on the first restyle and cleared by a restore,
-- exactly as `source_steps` was, so NULL still reads as "this part is the one
-- the recipe came with".
--
-- The backfill reads every kept step text into a step with no label and no
-- supporting line -- which is what it was -- and takes the notes from the
-- ingredient rows as they stand, which are the author's, since nothing before
-- this migration could rewrite one.

ALTER TABLE part ADD COLUMN source_part TEXT;

UPDATE part
SET source_part = json_object(
  'steps', (
    SELECT json_group_array(json_object('title', '', 'text', s.value, 'summary', ''))
    FROM json_each(part.source_steps) s
  ),
  'notes', (
    SELECT json_group_array(n.note)
    FROM (SELECT note FROM ingredient WHERE ingredient.part_id = part.id ORDER BY position) n
  )
)
WHERE source_steps IS NOT NULL;

ALTER TABLE part DROP COLUMN source_steps;
