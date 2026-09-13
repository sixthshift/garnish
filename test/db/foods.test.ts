import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { aisles } from "../../src/db/models/aisle/repo";
import { units } from "../../src/db/models/unit/repo";
import { foods, type FoodRepository } from "../../src/db/models/food/repo";
import { openDatabase } from "../../src/db/connection/open";
import { migrate } from "../../src/db/migrations/migrate";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let db: Database;
let repo: FoodRepository;
beforeEach(async () => {
  db = openDatabase(":memory:");
  await migrate(db);
  repo = foods(db);
});

test("create applies defaults and list returns by name", () => {
  const butter = repo.create({ name: "butter" });
  expect(butter.id).toMatch(UUID);
  expect(butter).toEqual({
    id: butter.id,
    name: "butter",
    pluralName: null,
    aliases: [],
    aisleId: null,
    recipeId: null,
    skipShopping: false,
    conversions: [],
  });

  const dairy = aisles(db).create({ name: "Dairy" });
  const apple = repo.create({ name: " Apple ", pluralName: "apples", aliases: ["granny smith"], aisleId: dairy.id, skipShopping: true });
  expect(apple).toMatchObject({ name: "Apple", pluralName: "apples", aliases: ["granny smith"], aisleId: dairy.id, skipShopping: true });

  expect(repo.list().map((f) => f.name)).toEqual(["Apple", "butter"]);
  expect(repo.get(apple.id)).toEqual(apple);
  expect(repo.get("missing")).toBeNull();
});

test("names collide case-insensitively on create", () => {
  repo.create({ name: "Butter" });
  expect(() => repo.create({ name: "butter" })).toThrow(/UNIQUE/);
  expect(() => repo.create({ name: "  BUTTER " })).toThrow(/UNIQUE/);
  expect(() => repo.create({ name: "  " })).toThrow(/required/);
  expect(repo.list()).toHaveLength(1);
});

test("findOrCreate returns the case-insensitive match instead of a new row", () => {
  const first = repo.findOrCreate("Butter");
  expect(repo.findOrCreate("butter")).toEqual(first);
  expect(repo.findOrCreate(" BUTTER ")).toEqual(first);
  const salt = repo.findOrCreate("salt");
  expect(salt.id).not.toBe(first.id);
  expect(repo.list()).toHaveLength(2);
});

test("update merges a patch, keeps the id, and enforces uniqueness", () => {
  const butter = repo.create({ name: "butter" });
  repo.create({ name: "salt" });

  const updated = repo.update(butter.id, { pluralName: "butters", aliases: ["unsalted butter"] });
  expect(updated).toEqual({ ...butter, pluralName: "butters", aliases: ["unsalted butter"] });
  expect(repo.update(butter.id, { name: "Butter" })?.name).toBe("Butter");
  expect(() => repo.update(butter.id, { name: "SALT" })).toThrow(/UNIQUE/);
  expect(repo.update("missing", { name: "x" })).toBeNull();
});

test("remove deletes the food and nulls the ingredient reference", () => {
  const butter = repo.create({ name: "butter" });
  db.run("INSERT INTO recipe (id, slug, name) VALUES ('r', 'r', 'R')");
  db.run("INSERT INTO part (id, recipe_id, position) VALUES ('c', 'r', 0)");
  db.run("INSERT INTO ingredient (id, part_id, position, quantity, food_id, original_text) VALUES ('i', 'c', 0, 50, ?, '50 g butter')", [butter.id]);

  expect(repo.remove(butter.id)).toBe(true);
  expect(repo.remove(butter.id)).toBe(false);
  expect(repo.list()).toEqual([]);
  expect(db.query<{ food_id: string | null; original_text: string }, []>("SELECT food_id, original_text FROM ingredient WHERE id = 'i'").get()).toEqual({
    food_id: null,
    original_text: "50 g butter",
  });
});

test("merge repoints ingredient rows to the target and deletes the source", () => {
  const butter = repo.create({ name: "butter" });
  const unsalted = repo.create({ name: "unsalted butter" });
  db.run("INSERT INTO recipe (id, slug, name) VALUES ('r', 'r', 'R')");
  db.run("INSERT INTO part (id, recipe_id, position) VALUES ('c', 'r', 0)");
  db.run("INSERT INTO ingredient (id, part_id, position, quantity, food_id, original_text) VALUES ('i1', 'c', 0, 50, ?, '50 g unsalted butter')", [
    unsalted.id,
  ]);
  db.run("INSERT INTO ingredient (id, part_id, position, quantity, food_id, original_text) VALUES ('i2', 'c', 1, 10, ?, '10 g butter')", [butter.id]);

  const merged = repo.merge(unsalted.id, butter.id);
  expect(merged).toEqual(butter);
  expect(repo.get(unsalted.id)).toBeNull();
  expect(repo.list().map((f) => f.name)).toEqual(["butter"]);

  const foodIds = db
    .query<{ id: string; food_id: string | null }, []>("SELECT id, food_id FROM ingredient ORDER BY id")
    .all();
  expect(foodIds).toEqual([
    { id: "i1", food_id: butter.id },
    { id: "i2", food_id: butter.id },
  ]);
});

test("merge is transactional and unknown ids return null without changing anything", () => {
  const butter = repo.create({ name: "butter" });
  expect(repo.merge("missing", butter.id)).toBeNull();
  expect(repo.merge(butter.id, "missing")).toBeNull();
  expect(repo.list()).toEqual([butter]);
});

test("merging a food into itself is a no-op that returns it unchanged", () => {
  const butter = repo.create({ name: "butter" });
  expect(repo.merge(butter.id, butter.id)).toEqual(butter);
  expect(repo.list()).toEqual([butter]);
});

test("list with q filters by case-insensitive substring and escapes wildcards", () => {
  repo.create({ name: "Butter" });
  repo.create({ name: "peanut butter" });
  repo.create({ name: "salt" });
  repo.create({ name: "100% cocoa" });
  expect(repo.list("BUTT").map((f) => f.name)).toEqual(["Butter", "peanut butter"]);
  expect(repo.list("%").map((f) => f.name)).toEqual(["100% cocoa"]);
  expect(repo.list("  ").map((f) => f.name)).toHaveLength(4);
  expect(repo.list("nothing")).toEqual([]);
});

// --- Conversions (M32.1, decisions.md row 69) --------------------------------

/** A cup, a gram and a millilitre to convert between. */
function seedUnits() {
  return { cup: units(db).create({ name: "cup" }), gram: units(db).create({ name: "gram" }), ml: units(db).create({ name: "millilitre" }) };
}

test("a food round-trips its conversions through create, get and list", () => {
  const { cup, gram } = seedUnits();
  const flour = repo.create({ name: "plain flour", conversions: [{ unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 125 }] });

  expect(flour.conversions).toEqual([{ id: expect.stringMatching(UUID), unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 125 }]);
  expect(repo.get(flour.id)).toEqual(flour);
  expect(repo.getByName("PLAIN FLOUR")).toEqual(flour);
  expect(repo.list()).toEqual([flour]);

  // A food without any reads back as an empty list, not undefined.
  const salt = repo.create({ name: "salt" });
  expect(salt.conversions).toEqual([]);
  // By name: "plain flour" then "salt", and each keeps its own rows.
  expect(repo.list().map((f) => [f.name, f.conversions.length])).toEqual([
    ["plain flour", 1],
    ["salt", 0],
  ]);
});

test("update replaces the conversions wholesale and leaves them alone when the patch omits them", () => {
  const { cup, gram, ml } = seedUnits();
  const flour = repo.create({ name: "flour", conversions: [{ unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 125 }] });

  const renamed = repo.update(flour.id, { name: "plain flour" })!;
  expect(renamed.name).toBe("plain flour");
  expect(renamed.conversions).toEqual(flour.conversions);

  const replaced = repo.update(flour.id, {
    conversions: [
      { unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 120 },
      { unitId: cup.id, quantity: 1, toUnitId: ml.id, toQuantity: 250 },
    ],
  })!;
  expect(replaced.conversions.map((c) => [c.toUnitId, c.toQuantity])).toEqual([
    [gram.id, 120],
    [ml.id, 250],
  ]);
  // Replaced, so the old row's id is gone.
  expect(replaced.conversions.map((c) => c.id)).not.toContain(flour.conversions[0]!.id);

  expect(repo.update(flour.id, { conversions: [] })!.conversions).toEqual([]);
});

test("setConversions writes this food's rows only, and is null for an unknown food", () => {
  const { cup, gram } = seedUnits();
  const flour = repo.create({ name: "flour" });
  const sugar = repo.create({ name: "sugar", conversions: [{ unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 220 }] });

  const written = repo.setConversions(flour.id, [{ unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 125 }])!;
  expect(written.conversions[0]).toMatchObject({ toQuantity: 125 });
  expect(repo.get(sugar.id)!.conversions).toEqual(sugar.conversions);
  expect(repo.setConversions("missing", [])).toBeNull();
});

test("the table refuses a repeated pair of units, and a deleted food or unit takes its conversions", () => {
  const { cup, gram } = seedUnits();
  const flour = repo.create({ name: "flour", conversions: [{ unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 125 }] });

  expect(() =>
    repo.setConversions(flour.id, [
      { unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 125 },
      { unitId: cup.id, quantity: 2, toUnitId: gram.id, toQuantity: 250 },
    ]),
  ).toThrow(/UNIQUE/);

  units(db).remove(gram.id);
  expect(repo.get(flour.id)!.conversions).toEqual([]);
});
