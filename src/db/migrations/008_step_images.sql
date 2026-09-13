-- Step images (M35.1).
--
-- A step may carry one photo, the way a recipe and a logged cook each do: the
-- column holds a file name under `data/images/steps/`, never bytes and never a
-- path, and the file is written by POST /api/steps/:id/image and served by
-- GET /api/images/steps/:file. Same shape as `recipe.image` and
-- `timeline_event.image` (002_stage2.sql), and the same reason: images are on
-- disk, the database is the index (architecture.md, Persistence).
--
-- Nullable with no default: most steps have no photo, and "no photo" is NULL
-- rather than an empty string, so the read is `image IS NULL` everywhere.
--
-- The file is named for the step id, so it survives a save: the repository
-- re-inserts a recipe's steps from the document on every write and keeps the
-- ids the document carried, and the document carries `image` beside `text`.
-- A step deleted in the editor leaves its file behind, exactly as a deleted
-- recipe leaves its image; the files are pruned by a backup, not by SQL.

ALTER TABLE step ADD COLUMN image TEXT;
