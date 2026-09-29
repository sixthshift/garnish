-- The seed batches a database has had (decisions.md row 121).
--
-- Units and the two guides are re-seeded on every start and matched by name,
-- which is right for a short list the household rarely touches. Foods are the
-- opposite: several hundred of them, renamed, merged and deleted as the
-- household cooks. Matched by name on every start, a merged-away "brown onion"
-- would come back the next morning. So the starter foods are a batch applied
-- once: `seed()` looks for the batch's name here, and a database that already
-- has it is never given that batch again, whatever it has done to the foods
-- since. A later addition to the list is a batch with a new name.

CREATE TABLE seed_batch (
  name        TEXT PRIMARY KEY,
  applied_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
