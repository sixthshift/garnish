// 022_on_hand_staples.sql flags the household's staples in a database made
// before the seed did: by name, case aside, and nothing else.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { openDatabase } from "../../../src/db/connection/open";
import { MIGRATIONS_DIR, migrate } from "../../../src/db/migrations/migrate";

test("the staples become on hand and every other food is left as it was", () => {
  const db = openDatabase(":memory:");
  migrate(db);
  db.exec("DELETE FROM food");
  const insert = db.prepare("INSERT INTO food (id, name, skip_shopping) VALUES (?, ?, ?)");
  insert.run("a", "Olive oil", 0);
  insert.run("b", "salt", 0);
  insert.run("c", "brown sugar", 0);
  insert.run("d", "water", 1);

  db.exec(readFileSync(join(MIGRATIONS_DIR, "022_on_hand_staples.sql"), "utf8"));

  expect(db.query("SELECT name, skip_shopping AS onHand FROM food ORDER BY id").all()).toEqual([
    { name: "Olive oil", onHand: 1 },
    { name: "salt", onHand: 1 },
    { name: "brown sugar", onHand: 0 },
    { name: "water", onHand: 1 },
  ]);
});
