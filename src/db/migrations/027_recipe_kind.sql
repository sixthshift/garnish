-- How the household cooks a recipe (decisions.md row 191): 'rotation', one
-- of the regulars the weeknights are filled from, or 'weekend', one worth
-- the time a Saturday has. NULL until someone says: never guessed from the
-- times or the cook log.

ALTER TABLE recipe ADD COLUMN kind TEXT CHECK (kind IS NULL OR kind IN ('rotation', 'weekend'));
