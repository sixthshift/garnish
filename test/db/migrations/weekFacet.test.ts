// 035_week_facet.sql folds the old `kind` into the week facet (decisions.md
// row 219): 'rotation' becomes 'weeknight', 'weekend' stays, the facets a
// recipe already had are kept, and the column goes.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { openDatabase } from "../../../src/db/connection/open";
import { MIGRATIONS_DIR, migrate } from "../../../src/db/migrations/migrate";

test("each recipe's kind becomes its week, beside the facets it had, and the column is dropped", () => {
  const db = openDatabase(":memory:");
  const before = Object.fromEntries(
    readdirSync(MIGRATIONS_DIR)
      .filter((file) => /^\d{3}_.+\.sql$/.test(file) && file < "035")
      .map((file) => [file, readFileSync(join(MIGRATIONS_DIR, file), "utf8")])
  );
  migrate(db, { sources: before });
  const insert = db.prepare("INSERT INTO recipe (id, slug, name, kind) VALUES (?, ?, ?, ?)");
  insert.run("a", "laksa", "Laksa", "rotation");
  insert.run("b", "lamb", "Lamb", "weekend");
  insert.run("c", "toast", "Toast", null);
  db.prepare("INSERT INTO recipe_facet (recipe_id, layer, value) VALUES (?, ?, ?)").run("a", "cuisine", "malaysian");

  migrate(db);

  expect(db.query("SELECT recipe_id, layer, value FROM recipe_facet ORDER BY recipe_id, layer").all()).toEqual([
    { recipe_id: "a", layer: "cuisine", value: "malaysian" },
    { recipe_id: "a", layer: "week", value: "weeknight" },
    { recipe_id: "b", layer: "week", value: "weekend" },
  ]);
  expect(db.query("SELECT name FROM pragma_table_info('recipe') WHERE name = 'kind'").all()).toEqual([]);
});
