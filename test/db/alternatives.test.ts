// A line's alternatives (decisions.md row 199), against the real migrations:
// written and read with the recipe, the plan's choice among the ones it
// picks, what a food's deletion or merge does to them, and migration 030
// carrying a database's options and line substitutes across.
import type { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../src/db/connection/open";
import { MIGRATIONS_DIR, migrate } from "../../src/db/migrations/migrate";
import { foodRepository } from "../../src/db/models/food/repo";
import { planRepository } from "../../src/db/models/plan/repo";
import { recipeRepository } from "../../src/db/models/recipe/repo";
import { unitRepository } from "../../src/db/models/unit/repo";
import { planEntryInputSchema } from "../../src/domain/plan/plan";
import { recipeInputSchema } from "../../src/domain/recipes/recipe";
import { migratedDb } from "../helpers/db";

let db: Database;
beforeEach(() => {
  db = migratedDb();
});

const count = (table: string) => (db.query(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;

function stirFry() {
  const gram = unitRepository(db).create({ name: "gram", abbreviation: "g" });
  const cup = unitRepository(db).create({ name: "cup" });
  const foods = foodRepository(db);
  const chicken = foods.create({ name: "chicken thigh" });
  const beef = foods.create({ name: "beef strips" });
  const milk = foods.create({ name: "milk" });
  const recipes = recipeRepository(db);
  const created = recipes.create(
    recipeInputSchema.parse({
      name: "Stir-fry",
      parts: [
        {
          name: "",
          ingredients: [
            {
              quantity: 500,
              unit: gram,
              food: chicken,
              alternatives: [
                { planPicks: true, items: [{ food: beef }] },
                // A food nobody has yet is found or created, as the line's own is.
                { planPicks: true, items: [{ quantity: 400, unit: gram, food: { id: crypto.randomUUID(), name: "Prawns" } }] },
                {
                  basisQuantity: 1,
                  basisUnit: cup,
                  note: "odd, but it works",
                  items: [
                    { quantity: 1, unit: cup, food: milk },
                    { quantity: 1, unit: gram, food: beef },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
  );
  return { gram, cup, foods, recipes, created, chicken, beef, milk, prawns: foods.getByName("prawns")! };
}

test("a line's alternatives save and read in order, and writing the document back keeps them", () => {
  const { gram, cup, recipes, created, beef, milk, prawns } = stirFry();
  const row = created.parts[0]!.ingredients[0]!;
  expect(row.alternatives).toMatchObject([
    { basisQuantity: null, planPicks: true, items: [{ quantity: null, unit: null, food: { id: beef.id } }] },
    { planPicks: true, items: [{ quantity: 400, unit: { id: gram.id }, food: { id: prawns.id } }] },
    { basisQuantity: 1, basisUnit: { id: cup.id }, note: "odd, but it works", planPicks: false, items: [{ food: { id: milk.id } }, { food: { id: beef.id } }] },
  ]);
  const again = recipes.ref(created.id).replace(recipeInputSchema.parse(created))!;
  expect(again.parts[0]!.ingredients[0]!.alternatives).toEqual(row.alternatives);
  expect(count("alternative")).toBe(3);
});

test("the plan can only pick a single food", () => {
  expect(
    recipeInputSchema.safeParse({
      name: "x",
      parts: [
        {
          ingredients: [
            {
              alternatives: [{ planPicks: true, items: [{ food: { id: crypto.randomUUID(), name: "a" } }, { food: { id: crypto.randomUUID(), name: "b" } }] }],
            },
          ],
        },
      ],
    }).success
  ).toBe(false);
});

test("deleting a food takes its items, and an alternative left with none goes with them", () => {
  const { foods, recipes, created, beef, milk, prawns } = stirFry();
  foods.remove(beef.id);
  const after = recipes.getById(created.id)!.parts[0]!.ingredients[0]!.alternatives;
  expect(after.map((alt) => alt.items.map((item) => item.food.id))).toEqual([[prawns.id], [milk.id]]);
  foods.remove(prawns.id);
  expect(count("alternative")).toBe(1);
});

test("merging a food moves it into others' alternatives, and drops it as the alternative to itself", () => {
  const { foods, recipes, created, chicken, beef, prawns } = stirFry();
  foods.merge(beef.id, chicken.id);
  const after = recipes.getById(created.id)!.parts[0]!.ingredients[0]!.alternatives;
  // "Beef strips" was its own alternative; as chicken thigh for chicken thigh it goes, and from the pair it leaves milk.
  expect(after.map((alt) => alt.items.map((item) => item.food.name))).toEqual([["Prawns"], ["milk"]]);
  expect(after[0]!.items[0]!.food.id).toBe(prawns.id);
});

test("a plan entry keeps its choice, names a food the plan picks, and says it has something to choose", () => {
  const { created, beef, milk, chicken } = stirFry();
  const plan = planRepository(db);
  const rowId = created.parts[0]!.ingredients[0]!.id;
  const entry = plan.add(planEntryInputSchema.parse({ date: "2026-11-04", recipeId: created.id, choices: { [rowId]: beef.id } }));
  expect(entry).toMatchObject({ choices: { [rowId]: beef.id }, chosen: ["beef strips"], choosable: true });
  // The line's own food, or a food the plan does not pick, names nothing.
  expect(plan.update(entry.id, { choices: { [rowId]: milk.id } })).toMatchObject({ chosen: [] });
  expect(plan.update(entry.id, { choices: { [rowId]: chicken.id } })).toMatchObject({ chosen: [] });
  expect(plan.choicesOf(created.id)).toEqual([{ [rowId]: chicken.id }]);
});

test("migration 030 brings a line's options across ticked and its substitutes unticked, and drops a food's own", () => {
  const old = openDatabase(":memory:");
  const files = readdirSync(MIGRATIONS_DIR).filter((file) => /^\d{3}_.*\.sql$/.test(file));
  const upTo = (last: number) =>
    Object.fromEntries(files.filter((f) => Number(f.slice(0, 3)) <= last).map((f) => [f, readFileSync(join(MIGRATIONS_DIR, f), "utf8")]));
  migrate(old, { sources: upTo(29) });
  old.exec(`
    INSERT INTO unit (id, name) VALUES ('u1', 'gram');
    INSERT INTO food (id, name) VALUES ('f-chicken', 'chicken thigh'), ('f-beef', 'beef strips'), ('f-tofu', 'tofu'), ('f-milk', 'milk'), ('f-buttermilk', 'buttermilk');
    INSERT INTO recipe (id, slug, name, created_at, updated_at) VALUES ('r1', 'stir-fry', 'Stir-fry', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    INSERT INTO part (id, recipe_id, position, name) VALUES ('p1', 'r1', 0, '');
    INSERT INTO ingredient (id, part_id, position, quantity, unit_id, food_id, substitutes_off) VALUES ('i1', 'p1', 0, 500, 'u1', 'f-chicken', 1);
    INSERT INTO ingredient_option (id, ingredient_id, position, food_id, quantity, unit_id) VALUES ('o1', 'i1', 0, 'f-beef', 400, 'u1');
    INSERT INTO substitute (id, ingredient_id, position, note) VALUES ('s1', 'i1', 0, 'pressed');
    INSERT INTO substitute_item (id, substitute_id, position, food_id) VALUES ('si1', 's1', 0, 'f-tofu');
    INSERT INTO substitute (id, food_id, position) VALUES ('s2', 'f-buttermilk', 0);
    INSERT INTO substitute_item (id, substitute_id, position, food_id) VALUES ('si2', 's2', 0, 'f-milk');
  `);
  migrate(old);

  const alternatives = old.query("SELECT ingredient_id, note, plan_picks FROM alternative ORDER BY position").all();
  expect(alternatives).toEqual([
    { ingredient_id: "i1", note: "", plan_picks: 1 },
    { ingredient_id: "i1", note: "pressed", plan_picks: 0 },
  ]);
  const items = old
    .query("SELECT food_id, quantity FROM alternative_item JOIN alternative ON alternative.id = alternative_id ORDER BY alternative.position")
    .all();
  expect(items).toEqual([
    { food_id: "f-beef", quantity: 400 },
    { food_id: "f-tofu", quantity: null },
  ]);
  for (const gone of ["substitute", "substitute_item", "ingredient_option"])
    expect(old.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(gone)).toBeNull();
  expect((old.query("PRAGMA table_info(ingredient)").all() as { name: string }[]).map((c) => c.name)).not.toContain("substitutes_off");
  // Item ids are minted in the migration; they are UUID-shaped like every other.
  const minted = (old.query("SELECT id FROM alternative_item WHERE food_id = 'f-beef'").get() as { id: string }).id;
  expect(minted).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  old.close();
});
