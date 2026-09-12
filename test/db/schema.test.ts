// Runs the real src/db/migrations/*.sql against :memory: and exercises the
// recipe tree: insert, read back in position order, cascade, set-null.
import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../src/db/connection/open";
import { migrate } from "../../src/db/migrations/migrate";

let db: Database;
beforeEach(async () => {
  db = openDatabase(":memory:");
  await migrate(db);
});

function tables(): string[] {
  return db
    .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((r) => r.name);
}

function count(table: string, where = "1 = 1", ...params: string[]): number {
  return db.query<{ n: number }, string[]>(`SELECT count(*) AS n FROM ${table} WHERE ${where}`).get(...params)!.n;
}

const ids = {
  recipe: "11111111-1111-4111-8111-111111111111",
  sauce: "22222222-2222-4222-8222-222222222222",
  pasta: "33333333-3333-4333-8333-333333333333",
  g: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  butter: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  spaghetti: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  tag: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  produce: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
};

/** One recipe, two parts in reverse insertion order so position ordering is tested. */
function seedRecipe() {
  db.run("INSERT INTO aisle (id, name, position) VALUES (?, ?, ?)", [ids.produce, "Dairy", 0]);
  db.run("INSERT INTO unit (id, name, abbreviation, use_abbreviation) VALUES (?, ?, ?, ?)", [ids.g, "gram", "g", 1]);
  db.run("INSERT INTO food (id, name, aisle_id) VALUES (?, ?, ?)", [ids.butter, "butter", ids.produce]);
  db.run("INSERT INTO food (id, name, plural_name) VALUES (?, ?, ?)", [ids.spaghetti, "spaghetti", "spaghetti"]);
  db.run("INSERT INTO tag (id, name, slug) VALUES (?, ?, ?)", [ids.tag, "Weeknight", "weeknight"]);

  db.run(
    "INSERT INTO recipe (id, slug, name, servings, yield_quantity, yield_unit_id, yield_text, prep_minutes, cook_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [ids.recipe, "butter-pasta", "Butter pasta", 2, 600, ids.g, "600 g", 5, 15],
  );
  db.run("INSERT INTO recipe_tag (recipe_id, tag_id) VALUES (?, ?)", [ids.recipe, ids.tag]);
  db.run("INSERT INTO recipe_note (id, recipe_id, position, title, text) VALUES (?, ?, ?, ?, ?)", [
    "note-1",
    ids.recipe,
    0,
    "Tip",
    "Salt the water well.",
  ]);

  // Second part inserted first.
  db.run("INSERT INTO part (id, recipe_id, position, name) VALUES (?, ?, ?, ?)", [ids.sauce, ids.recipe, 1, "Sauce"]);
  db.run("INSERT INTO part (id, recipe_id, position, name) VALUES (?, ?, ?, ?)", [ids.pasta, ids.recipe, 0, "Pasta"]);

  db.run(
    "INSERT INTO ingredient (id, part_id, position, quantity, unit_id, food_id, note, original_text, fixed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ["ing-pasta-1", ids.pasta, 1, null, null, null, "", "salt, to taste", 0],
  );
  db.run(
    "INSERT INTO ingredient (id, part_id, position, quantity, unit_id, food_id, note, original_text, fixed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ["ing-pasta-0", ids.pasta, 0, 200, ids.g, ids.spaghetti, "", "200 g spaghetti", 0],
  );
  db.run(
    "INSERT INTO ingredient (id, part_id, position, quantity, unit_id, food_id, note, original_text, fixed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ["ing-sauce-0", ids.sauce, 0, 50, ids.g, ids.butter, "cold", "50 g cold butter", 1],
  );

  // Steps belong to a part, and position is scoped to it.
  db.run("INSERT INTO step (id, part_id, position, text) VALUES (?, ?, ?, ?)", [
    "step-pasta-1",
    ids.pasta,
    1,
    "Toss together and serve.",
  ]);
  db.run("INSERT INTO step (id, part_id, position, text) VALUES (?, ?, ?, ?)", ["step-sauce-0", ids.sauce, 0, "Melt the butter."]);
  db.run("INSERT INTO step (id, part_id, position, text) VALUES (?, ?, ?, ?)", ["step-pasta-0", ids.pasta, 0, "Boil the pasta."]);
}

test("the migrations create every table in architecture.md", () => {
  expect(tables()).toEqual([
    "aisle",
    "food",
    "ingredient",
    "migration",
    "part",
    "recipe",
    "recipe_note",
    "recipe_tag",
    "shopping_item",
    "shopping_item_source",
    "step",
    "step_ingredient",
    "tag",
    "timeline_event",
    "unit",
  ]);
  expect(db.query<{ ok: string | null }, []>("PRAGMA foreign_key_check").all()).toEqual([]);
});

test("a recipe with two parts reads back in position order", () => {
  seedRecipe();

  const recipe = db
    .query<Record<string, unknown>, [string]>("SELECT * FROM recipe WHERE slug = ?")
    .get("butter-pasta")!;
  expect(recipe).toMatchObject({
    id: ids.recipe,
    name: "Butter pasta",
    description: "",
    image: null,
    rating: null,
    servings: 2,
    yield_quantity: 600,
    yield_unit_id: ids.g,
    yield_text: "600 g",
    prep_minutes: 5,
    cook_minutes: 15,
    source_url: null,
  });
  expect(recipe.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  expect(recipe.updated_at).toBe(recipe.created_at);

  const parts = db
    .query<{ id: string; position: number; name: string }, [string]>(
      "SELECT id, position, name FROM part WHERE recipe_id = ? ORDER BY position",
    )
    .all(ids.recipe);
  expect(parts).toEqual([
    { id: ids.pasta, position: 0, name: "Pasta" },
    { id: ids.sauce, position: 1, name: "Sauce" },
  ]);

  const ingredients = (partId: string) =>
    db
      .query<Record<string, unknown>, [string]>(
        "SELECT position, quantity, unit_id, food_id, note, original_text, fixed FROM ingredient WHERE part_id = ? ORDER BY position",
      )
      .all(partId);
  expect(ingredients(ids.pasta)).toEqual([
    { position: 0, quantity: 200, unit_id: ids.g, food_id: ids.spaghetti, note: "", original_text: "200 g spaghetti", fixed: 0 },
    { position: 1, quantity: null, unit_id: null, food_id: null, note: "", original_text: "salt, to taste", fixed: 0 },
  ]);
  expect(ingredients(ids.sauce)).toEqual([
    { position: 0, quantity: 50, unit_id: ids.g, food_id: ids.butter, note: "cold", original_text: "50 g cold butter", fixed: 1 },
  ]);

  const steps = db
    .query<{ position: number; part_id: string; text: string }, [string]>(
      "SELECT s.position, s.part_id, s.text FROM step s JOIN part p ON p.id = s.part_id WHERE p.recipe_id = ? ORDER BY p.position, s.position",
    )
    .all(ids.recipe);
  expect(steps).toEqual([
    { position: 0, part_id: ids.pasta, text: "Boil the pasta." },
    { position: 1, part_id: ids.pasta, text: "Toss together and serve." },
    { position: 0, part_id: ids.sauce, text: "Melt the butter." },
  ]);

  expect(db.query<{ title: string; text: string }, [string]>("SELECT title, text FROM recipe_note WHERE recipe_id = ? ORDER BY position").all(ids.recipe)).toEqual([
    { title: "Tip", text: "Salt the water well." },
  ]);
  expect(
    db
      .query<{ name: string; slug: string }, [string]>(
        "SELECT t.name, t.slug FROM recipe_tag rt JOIN tag t ON t.id = rt.tag_id WHERE rt.recipe_id = ?",
      )
      .all(ids.recipe),
  ).toEqual([{ name: "Weeknight", slug: "weeknight" }]);
});

test("deleting a recipe cascades to its parts, ingredients, steps, notes and tags, not to references", () => {
  seedRecipe();
  db.run("UPDATE food SET recipe_id = ? WHERE id = ?", [ids.recipe, ids.butter]);

  db.run("DELETE FROM recipe WHERE id = ?", [ids.recipe]);

  expect(count("recipe")).toBe(0);
  expect(count("part")).toBe(0);
  expect(count("ingredient")).toBe(0);
  expect(count("step")).toBe(0);
  expect(count("recipe_note")).toBe(0);
  expect(count("recipe_tag")).toBe(0);

  expect(count("tag")).toBe(1);
  expect(count("unit")).toBe(1);
  expect(count("food")).toBe(2);
  expect(count("aisle")).toBe(1);
  expect(db.query<{ recipe_id: string | null }, [string]>("SELECT recipe_id FROM food WHERE id = ?").get(ids.butter)?.recipe_id).toBeNull();
});

test("deleting a part cascades to its ingredients and its steps", () => {
  seedRecipe();
  db.run("DELETE FROM part WHERE id = ?", [ids.sauce]);

  expect(count("ingredient", "part_id = ?", ids.sauce)).toBe(0);
  expect(count("ingredient")).toBe(2);
  expect(count("step", "part_id = ?", ids.sauce)).toBe(0);
  expect(count("step")).toBe(2);
});

test("deleting a food, unit or aisle sets references null", () => {
  seedRecipe();

  db.run("DELETE FROM food WHERE id = ?", [ids.butter]);
  db.run("DELETE FROM unit WHERE id = ?", [ids.g]);
  db.run("DELETE FROM aisle WHERE id = ?", [ids.produce]);

  const sauce = db
    .query<{ quantity: number; unit_id: string | null; food_id: string | null; original_text: string }, [string]>(
      "SELECT quantity, unit_id, food_id, original_text FROM ingredient WHERE id = ?",
    )
    .get("ing-sauce-0");
  expect(sauce).toEqual({ quantity: 50, unit_id: null, food_id: null, original_text: "50 g cold butter" });
  expect(db.query<{ yield_unit_id: string | null }, [string]>("SELECT yield_unit_id FROM recipe WHERE id = ?").get(ids.recipe)?.yield_unit_id).toBeNull();
  expect(db.query<{ aisle_id: string | null }, []>("SELECT aisle_id FROM food").all().every((f) => f.aisle_id === null)).toBe(true);
});

test("deleting a tag removes its recipe links only", () => {
  seedRecipe();
  db.run("DELETE FROM tag WHERE id = ?", [ids.tag]);
  expect(count("recipe_tag")).toBe(0);
  expect(count("recipe")).toBe(1);
});

test("constraints: unique slug, case-insensitive food/unit/tag/aisle names, boolean flags, required parents", () => {
  seedRecipe();

  expect(() => db.run("INSERT INTO recipe (id, slug, name) VALUES ('r2', 'butter-pasta', 'Dup')")).toThrow(/UNIQUE/);
  expect(() => db.run("INSERT INTO food (id, name) VALUES ('f3', 'Butter')")).toThrow(/UNIQUE/);
  expect(() => db.run("INSERT INTO unit (id, name) VALUES ('u2', 'GRAM')")).toThrow(/UNIQUE/);
  expect(() => db.run("INSERT INTO tag (id, name, slug) VALUES ('t2', 'weeknight', 'other')")).toThrow(/UNIQUE/);
  expect(() => db.run("INSERT INTO aisle (id, name) VALUES ('a2', 'dairy')")).toThrow(/UNIQUE/);
  expect(() => db.run(`INSERT INTO part (id, recipe_id, position) VALUES ('c3', '${ids.recipe}', 0)`)).toThrow(/UNIQUE/);

  expect(() => db.run(`INSERT INTO ingredient (id, part_id, position, fixed) VALUES ('i9', '${ids.pasta}', 9, 2)`)).toThrow(/CHECK/);
  expect(() => db.run("INSERT INTO recipe (id, slug, name, rating) VALUES ('r3', 'r3', 'R3', 6)")).toThrow(/CHECK/);

  expect(() => db.run("INSERT INTO part (id, recipe_id, position) VALUES ('c4', 'missing', 0)")).toThrow(/FOREIGN KEY/);
  expect(() => db.run("INSERT INTO ingredient (id, part_id, position) VALUES ('i4', 'missing', 0)")).toThrow(/FOREIGN KEY/);
  expect(() => db.run(`INSERT INTO ingredient (id, part_id, position, food_id) VALUES ('i5', '${ids.pasta}', 5, 'missing')`)).toThrow(/FOREIGN KEY/);
  expect(() => db.run(`INSERT INTO part (id, recipe_id, position) VALUES ('c5', NULL, 0)`)).toThrow(/NOT NULL/);
});

test("defaults: description, note, original_text, aliases and flags", () => {
  db.run("INSERT INTO recipe (id, slug, name) VALUES ('r', 'r', 'R')");
  db.run("INSERT INTO part (id, recipe_id, position) VALUES ('c', 'r', 0)");
  db.run("INSERT INTO ingredient (id, part_id, position) VALUES ('i', 'c', 0)");
  db.run("INSERT INTO food (id, name) VALUES ('f', 'water')");
  db.run("INSERT INTO unit (id, name) VALUES ('u', 'cup')");

  expect(db.query<Record<string, unknown>, []>("SELECT description, servings, yield_quantity, yield_text FROM recipe").get()).toEqual({
    description: "",
    servings: 0,
    yield_quantity: 0,
    yield_text: "",
  });
  expect(db.query<{ name: string }, []>("SELECT name FROM part").get()?.name).toBe("");
  expect(db.query<Record<string, unknown>, []>("SELECT quantity, unit_id, food_id, note, original_text, fixed FROM ingredient").get()).toEqual({
    quantity: null,
    unit_id: null,
    food_id: null,
    note: "",
    original_text: "",
    fixed: 0,
  });
  expect(db.query<Record<string, unknown>, []>("SELECT plural_name, aliases, aisle_id, recipe_id, skip_shopping FROM food").get()).toEqual({
    plural_name: null,
    aliases: "[]",
    aisle_id: null,
    recipe_id: null,
    skip_shopping: 0,
  });
  expect(db.query<Record<string, unknown>, []>("SELECT abbreviation, use_abbreviation, fraction, standard_quantity, standard_unit_id FROM unit").get()).toEqual({
    abbreviation: "",
    use_abbreviation: 0,
    fraction: 1,
    standard_quantity: null,
    standard_unit_id: null,
  });
});

// --- 002_stage2 -------------------------------------------------------------

test("002 adds recipe.favourite defaulting to 0 and constrained to a boolean", () => {
  db.run("INSERT INTO recipe (id, slug, name) VALUES ('r', 'r', 'R')");
  expect(db.query<{ favourite: number }, []>("SELECT favourite FROM recipe").get()?.favourite).toBe(0);

  db.run("UPDATE recipe SET favourite = 1 WHERE id = 'r'");
  expect(db.query<{ favourite: number }, []>("SELECT favourite FROM recipe").get()?.favourite).toBe(1);
  expect(() => db.run("UPDATE recipe SET favourite = 2 WHERE id = 'r'")).toThrow(/CHECK/);
});

test("timeline_event requires a recipe and a YYYY-MM-DD date, and defaults message and created_at", () => {
  seedRecipe();

  db.run("INSERT INTO timeline_event (id, recipe_id, occurred_on) VALUES (?, ?, ?)", ["ev-1", ids.recipe, "2026-09-01"]);
  const row = db.query<Record<string, unknown>, []>("SELECT * FROM timeline_event").get()!;
  expect(row).toMatchObject({ id: "ev-1", recipe_id: ids.recipe, occurred_on: "2026-09-01", message: "", image: null });
  expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

  expect(() => db.run("INSERT INTO timeline_event (id, recipe_id, occurred_on) VALUES ('ev-2', 'missing', '2026-09-01')")).toThrow(/FOREIGN KEY/);
  expect(() => db.run(`INSERT INTO timeline_event (id, recipe_id, occurred_on) VALUES ('ev-3', '${ids.recipe}', '1 Sep 2026')`)).toThrow(/CHECK/);
  expect(() => db.run(`INSERT INTO timeline_event (id, recipe_id) VALUES ('ev-4', '${ids.recipe}')`)).toThrow(/NOT NULL/);
});

test("deleting a recipe cascades to its timeline events", () => {
  seedRecipe();
  db.run("INSERT INTO timeline_event (id, recipe_id, occurred_on) VALUES (?, ?, ?)", ["ev-1", ids.recipe, "2026-09-01"]);

  db.run("DELETE FROM recipe WHERE id = ?", [ids.recipe]);
  expect(count("timeline_event")).toBe(0);
});
