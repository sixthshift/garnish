// Shopping list repository against :memory: with the real migrations: the
// round trip of a line and its sources, ticking, clearing, reordering, and the
// two deletes that must not take a line with them — the food it names, and the
// recipe it came from.
import type { Database } from "bun:sqlite";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../src/db/connection/open";
import { MIGRATIONS_DIR, migrate } from "../../src/db/migrations/migrate";
import { aisleRepository } from "../../src/db/models/aisle/repo";
import { foodRepository } from "../../src/db/models/food/repo";
import { recipeRepository } from "../../src/db/models/recipe/repo";
import { type ShoppingRepository, shoppingRepository } from "../../src/db/models/shopping/repo";
import { unitRepository } from "../../src/db/models/unit/repo";
import { type RecipeInput, recipeInputSchema } from "../../src/domain/recipe";
import { type ShoppingItemInput, shoppingItemInputSchema, shoppingItemSchema } from "../../src/domain/shopping";

let db: Database;
let repo: ShoppingRepository;

const parse = (input: ShoppingItemInput) => shoppingItemInputSchema.parse(input);

beforeEach(async () => {
  db = openDatabase(":memory:");
  migrate(db);
  repo = shoppingRepository(db);
});

function seedFlour() {
  const aisle = aisleRepository(db).create({ name: "Baking" });
  const food = foodRepository(db).create({ name: "Plain flour", aisleId: aisle.id });
  const unit = unitRepository(db).create({ name: "gram", abbreviation: "g" });
  return { aisle, food, unit };
}

function seedRecipe(name = "Lemon tart"): { id: string } {
  const doc: RecipeInput = { name, parts: [{ name: "", ingredients: [], steps: [] }] };
  return recipeRepository(db).create(recipeInputSchema.parse(doc));
}

test("the list starts empty", () => {
  expect(repo.list()).toEqual([]);
  expect(repo.get("11111111-1111-4111-8111-111111111111")).toBeNull();
});

test("a food line round-trips with its nested food, aisle, unit and sources", () => {
  const { aisle, food, unit } = seedFlour();
  const recipe = seedRecipe();

  const [item] = repo.addMany([
    parse({
      quantity: 250,
      foodId: food.id,
      unitId: unit.id,
      sources: [{ recipeId: recipe.id, recipeName: "Lemon tart", partName: "Pastry", servings: 4, quantity: 250 }],
    }),
  ]);

  expect(item!.quantity).toBe(250);
  expect(item!.food?.id).toBe(food.id);
  expect(item!.food?.aisle?.id).toBe(aisle.id);
  expect(item!.unit?.id).toBe(unit.id);
  expect(item!.text).toBe("");
  expect(item!.ticked).toBe(false);
  expect(item!.position).toBe(0);
  expect(item!.sources).toMatchObject([{ recipeId: recipe.id, recipeName: "Lemon tart", partName: "Pastry", servings: 4, quantity: 250 }]);
  expect(shoppingItemSchema.parse(item)).toEqual(item);
  expect(repo.get(item!.id)).toEqual(item);
  expect(repo.list()).toEqual([item]);
});

test("a free-text line round-trips with no food, unit or sources", () => {
  const [item] = repo.addMany([parse({ text: "Batteries" })]);
  expect(item!.text).toBe("Batteries");
  expect(item!.food).toBeNull();
  expect(item!.unit).toBeNull();
  expect(item!.quantity).toBeNull();
  expect(item!.sources).toEqual([]);
  expect(shoppingItemSchema.parse(item)).toEqual(item);
});

test("addMany appends in order and keeps appending on a second call", () => {
  const first = repo.addMany([parse({ text: "Milk" }), parse({ text: "Bread" })]);
  expect(first.map((i) => [i.text, i.position])).toEqual([
    ["Milk", 0],
    ["Bread", 1],
  ]);

  const second = repo.addMany([parse({ text: "Eggs" })]);
  expect(second[0]!.position).toBe(2);
  expect(repo.list().map((i) => i.text)).toEqual(["Milk", "Bread", "Eggs"]);
});

test("addMany with nothing to add writes nothing", () => {
  expect(repo.addMany([])).toEqual([]);
  expect(repo.list()).toEqual([]);
});

test("a line keeps several sources in the order they were added", () => {
  const [item] = repo.addMany([
    parse({
      text: "Butter",
      sources: [
        { recipeName: "Lemon tart", partName: "Pastry", quantity: 100 },
        { recipeName: "Flatbread", partName: "", quantity: 50 },
      ],
    }),
  ]);
  expect(item!.sources.map((s) => s.recipeName)).toEqual(["Lemon tart", "Flatbread"]);
});

test("update merges a patch and moves updated_at without touching created_at", async () => {
  const [item] = repo.addMany([parse({ text: "Milk" })]);
  await new Promise((r) => setTimeout(r, 5));

  const updated = repo.update(item!.id, { quantity: 2, text: "Milk, full cream" });
  expect(updated!.quantity).toBe(2);
  expect(updated!.text).toBe("Milk, full cream");
  expect(updated!.createdAt).toBe(item!.createdAt);
  expect(updated!.updatedAt >= item!.updatedAt).toBe(true);
  expect(repo.update("11111111-1111-4111-8111-111111111111", { text: "x" })).toBeNull();
});

test("update leaves the fields the patch does not name alone", () => {
  const { food } = seedFlour();
  const [item] = repo.addMany([parse({ quantity: 250, foodId: food.id })]);
  const updated = repo.update(item!.id, { ticked: true });
  expect(updated!.quantity).toBe(250);
  expect(updated!.food?.id).toBe(food.id);
  expect(updated!.ticked).toBe(true);
});

test("tick and untick a line, and miss on an unknown id", () => {
  const [item] = repo.addMany([parse({ text: "Milk" })]);
  expect(repo.tick(item!.id, true)!.ticked).toBe(true);
  expect(repo.tick(item!.id, false)!.ticked).toBe(false);
  expect(repo.tick("11111111-1111-4111-8111-111111111111", true)).toBeNull();
});

test("remove deletes the line and cascades to its sources", () => {
  const [item] = repo.addMany([parse({ text: "Butter", sources: [{ recipeName: "Lemon tart" }] })]);
  expect(repo.remove(item!.id)).toBe(true);
  expect(repo.list()).toEqual([]);
  expect(repo.remove(item!.id)).toBe(false);
  const left = db.query<{ n: number }, []>("SELECT count(*) AS n FROM shopping_item_source").get();
  expect(left?.n).toBe(0);
});

test("clearTicked deletes only the ticked lines and reports how many went", () => {
  const [milk, bread, eggs] = repo.addMany([parse({ text: "Milk" }), parse({ text: "Bread" }), parse({ text: "Eggs" })]);
  repo.tick(milk!.id, true);
  repo.tick(eggs!.id, true);

  expect(repo.clearTicked()).toBe(2);
  expect(repo.list().map((i) => i.id)).toEqual([bread!.id]);
  expect(repo.clearTicked()).toBe(0);
});

test("reorder writes the sent order and ignores an id that is not on the list", () => {
  const [milk, bread, eggs] = repo.addMany([parse({ text: "Milk" }), parse({ text: "Bread" }), parse({ text: "Eggs" })]);

  const after = repo.reorder([eggs!.id, "11111111-1111-4111-8111-111111111111", milk!.id, bread!.id]);
  expect(after.map((i) => i.text)).toEqual(["Eggs", "Milk", "Bread"]);
  expect(after.map((i) => i.position)).toEqual([0, 2, 3]);
  expect(repo.list().map((i) => i.text)).toEqual(["Eggs", "Milk", "Bread"]);
});

test("a source survives its recipe being deleted, keeping the copied names", () => {
  const recipe = seedRecipe("Lemon tart");
  const [item] = repo.addMany([
    parse({
      text: "Butter",
      sources: [{ recipeId: recipe.id, recipeName: "Lemon tart", partName: "Pastry", servings: 4, quantity: 100 }],
    }),
  ]);

  expect(recipeRepository(db).remove(recipe.id)).toBe(true);

  const after = repo.get(item!.id)!;
  expect(after.sources).toHaveLength(1);
  expect(after.sources[0]!.recipeId).toBeNull();
  expect(after.sources[0]!.recipeName).toBe("Lemon tart");
  expect(after.sources[0]!.partName).toBe("Pastry");
  expect(after.sources[0]!.servings).toBe(4);
  expect(shoppingItemSchema.parse(after)).toEqual(after);
});

test("a line survives its food and unit being deleted, keeping its quantity", () => {
  const { food, unit } = seedFlour();
  const [item] = repo.addMany([parse({ quantity: 250, foodId: food.id, unitId: unit.id })]);

  expect(foodRepository(db).remove(food.id)).toBe(true);
  expect(unitRepository(db).remove(unit.id)).toBe(true);

  const after = repo.get(item!.id)!;
  expect(after.food).toBeNull();
  expect(after.unit).toBeNull();
  expect(after.quantity).toBe(250);
});

test("005 applies to an existing database migrated only as far as 004", async () => {
  const dir = mkdtempSync(join(tmpdir(), "garnish-migrations-"));
  mkdirSync(dir, { recursive: true });
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const earlier = files.filter((f) => !f.startsWith("005_"));
  for (const file of earlier) copyFileSync(join(MIGRATIONS_DIR, file), join(dir, file));

  const existing = openDatabase(":memory:");
  migrate(existing, { migrationsDir: dir });
  const before = existing.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'shopping%'").all();
  expect(before).toEqual([]);

  for (const file of files.filter((f) => f.startsWith("005_"))) {
    copyFileSync(join(MIGRATIONS_DIR, file), join(dir, file));
  }
  const applied = migrate(existing, { migrationsDir: dir });
  expect(applied.map((m) => m.id)).toEqual([5]);

  const after = existing
    .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'shopping%'")
    .all()
    .map((r) => r.name)
    .sort();
  expect(after).toEqual(["shopping_item", "shopping_item_source"]);
  existing.close();
});
