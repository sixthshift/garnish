import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { aisles } from "../../src/db/aisles";
import { foods, type FoodRepository } from "../../src/db/foods";
import { migrate, openDatabase } from "../../src/db/migrate";

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
  db.run("INSERT INTO component (id, recipe_id, position) VALUES ('c', 'r', 0)");
  db.run("INSERT INTO ingredient (id, component_id, position, quantity, food_id, original_text) VALUES ('i', 'c', 0, 50, ?, '50 g butter')", [butter.id]);

  expect(repo.remove(butter.id)).toBe(true);
  expect(repo.remove(butter.id)).toBe(false);
  expect(repo.list()).toEqual([]);
  expect(db.query<{ food_id: string | null; original_text: string }, []>("SELECT food_id, original_text FROM ingredient WHERE id = 'i'").get()).toEqual({
    food_id: null,
    original_text: "50 g butter",
  });
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
