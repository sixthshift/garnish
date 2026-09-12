-- `component` becomes `part`, and every step belongs to one (decisions 48, 49).
--
-- Two changes, one file, because the second depends on the first:
--   1. The table and both foreign keys are renamed. `component` collided with
--      React components everywhere else in the tree.
--   2. Steps move from the recipe to the part. `step.recipe_id` is dropped —
--      it is reachable through the part — and `position` is scoped to the part
--      instead of being recipe-wide. The unnamed part ('') is the recipe's main
--      body, so recipe-level steps land there rather than needing a heading.

ALTER TABLE component RENAME TO part;
ALTER TABLE ingredient RENAME COLUMN component_id TO part_id;

-- A recipe with recipe-level steps needs an unnamed part to hold them. Reuse
-- the one it already has, or append one after its named parts.
INSERT INTO part (id, recipe_id, position, name)
SELECT
  lower(
    hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2)
    || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2)
    || '-' || hex(randomblob(6))
  ),
  r.id,
  (SELECT count(*) FROM part p WHERE p.recipe_id = r.id),
  ''
FROM recipe r
WHERE EXISTS (SELECT 1 FROM step s WHERE s.recipe_id = r.id AND s.component_id IS NULL)
  AND NOT EXISTS (SELECT 1 FROM part p WHERE p.recipe_id = r.id AND p.name = '');

-- Rebuilt rather than altered: part_id becomes NOT NULL, recipe_id goes, and
-- the unique key changes from (recipe_id, position) to (part_id, position).
-- The old table steps aside so the new one is created under the real name.
ALTER TABLE step RENAME TO step_old;

CREATE TABLE step (
  id        TEXT PRIMARY KEY,
  part_id   TEXT NOT NULL REFERENCES part(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  text      TEXT NOT NULL DEFAULT '',
  UNIQUE (part_id, position)
);

-- Recipe-wide position ordered a part's own steps before the recipe-level ones,
-- so renumbering within each part preserves the order the recipe was read in.
INSERT INTO step (id, part_id, position, text)
SELECT
  s.id,
  target.id,
  row_number() OVER (PARTITION BY target.id ORDER BY s.position) - 1,
  s.text
FROM step_old s
JOIN part target ON target.id = COALESCE(
  s.component_id,
  (SELECT p.id FROM part p WHERE p.recipe_id = s.recipe_id AND p.name = '' ORDER BY p.position LIMIT 1)
);

DROP TABLE step_old;  -- takes step_component_id with it; (part_id, position) covers the lookup
