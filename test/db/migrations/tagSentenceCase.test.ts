// 021_tag_sentence_case.sql brings the tags made before the house rule into
// line: the first letter capital, the rest untouched, the slug unchanged.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { openDatabase } from "../../../src/db/connection/open";
import { MIGRATIONS_DIR, migrate } from "../../../src/db/migrations/migrate";

test("existing tag names gain a capital first letter and keep their slugs", () => {
  const db = openDatabase(":memory:");
  migrate(db);
  const insert = db.prepare("INSERT INTO tag (id, name, slug) VALUES (?, ?, ?)");
  insert.run("a", "chinese", "chinese");
  insert.run("b", "easy pasta dinner", "easy-pasta-dinner");
  insert.run("c", "BBQ", "bbq");
  insert.run("d", "émincé", "emince");

  db.exec(readFileSync(join(MIGRATIONS_DIR, "021_tag_sentence_case.sql"), "utf8"));

  expect(db.query("SELECT name, slug FROM tag ORDER BY id").all()).toEqual([
    { name: "Chinese", slug: "chinese" },
    { name: "Easy pasta dinner", slug: "easy-pasta-dinner" },
    { name: "BBQ", slug: "bbq" },
    // upper() folds ASCII only; the app's rule capitalises this on its next save.
    { name: "émincé", slug: "emince" },
  ]);
});
