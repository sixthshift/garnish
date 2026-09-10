// Which recipes use a reference row: the queries Settings shows before a
// delete. Against :memory: with the real migration.
import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { migrate, openDatabase } from "../../src/db/migrate";
import { recipes, type RecipeRepository } from "../../src/db/recipes";
import { recipeInputSchema, recipeSummarySchema, type RecipeInput } from "../../src/domain/recipe";

let db: Database;
let repo: RecipeRepository;
beforeEach(async () => {
  db = openDatabase(":memory:");
  await migrate(db);
  repo = recipes(db);
});

const gram = { id: crypto.randomUUID(), name: "gram", pluralName: "grams", abbreviation: "g", useAbbreviation: true, fraction: false, standardQuantity: null, standardUnitId: null };
const millilitre = { ...gram, id: crypto.randomUUID(), name: "millilitre", pluralName: "millilitres", abbreviation: "ml" };
const butter = { id: crypto.randomUUID(), name: "butter", pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false };
const flour = { ...butter, id: crypto.randomUUID(), name: "flour" };
const weeknight = { id: crypto.randomUUID(), name: "Weeknight", slug: "weeknight" };
const baking = { id: crypto.randomUUID(), name: "Baking", slug: "baking" };

type Ingredients = RecipeInput["components"][number]["ingredients"];

function make(name: string, ingredients: Ingredients, extra: Partial<RecipeInput> = {}) {
  return repo.create(
    recipeInputSchema.parse({
      name,
      components: [{ name: "", ingredients, steps: [] }],
      ...extra,
    } satisfies RecipeInput),
  );
}

/** The reference row the server actually stored, found by name. */
function idOf(table: "food" | "unit" | "tag", name: string): string {
  return db.query<{ id: string }, [string]>(`SELECT id FROM ${table} WHERE name = ?`).get(name)!.id;
}

test("usingFood lists every recipe with an ingredient of that food, once, by name", () => {
  make("Shortbread", [{ quantity: 200, unit: gram, food: butter }, { quantity: 300, unit: gram, food: flour }]);
  make("Buttered toast", [{ quantity: 10, unit: gram, food: butter }, { quantity: 10, unit: gram, food: butter }]);
  make("Boiled water", [{ quantity: 500, unit: millilitre, food: null }]);

  const used = repo.usingFood(idOf("food", "butter"));
  expect(used.map((recipe) => recipe.name)).toEqual(["Buttered toast", "Shortbread"]);
  // Full summaries, so the dialog can show whatever a card shows.
  expect(recipeSummarySchema.parse(used[0])).toEqual(used[0]);
  expect(used[0]!.slug).toBe("buttered-toast");

  expect(repo.usingFood(idOf("food", "flour")).map((recipe) => recipe.name)).toEqual(["Shortbread"]);
  expect(repo.usingFood(crypto.randomUUID())).toEqual([]);
});

test("usingUnit counts an ingredient's unit and the recipe's yield unit, without duplicates", () => {
  make("Shortbread", [{ quantity: 200, unit: gram, food: butter }], { recipeYieldQuantity: 12, yieldUnit: gram, recipeYield: "12 biscuits" });
  make("Stock", [{ quantity: 500, unit: millilitre, food: null }]);
  make("Syrup", [{ quantity: 100, unit: null, food: null }], { yieldUnit: millilitre });
  make("Salad", [{ quantity: null, unit: null, food: flour }]);

  expect(repo.usingUnit(idOf("unit", "gram")).map((recipe) => recipe.name)).toEqual(["Shortbread"]);
  expect(repo.usingUnit(idOf("unit", "millilitre")).map((recipe) => recipe.name)).toEqual(["Stock", "Syrup"]);
  expect(repo.usingUnit(crypto.randomUUID())).toEqual([]);
});

test("usingTag lists the recipes carrying the tag", () => {
  make("Shortbread", [], { tags: [weeknight, baking] });
  make("Pancakes", [], { tags: [baking] });
  make("Curry", [], { tags: [] });

  expect(repo.usingTag(idOf("tag", "Baking")).map((recipe) => recipe.name)).toEqual(["Pancakes", "Shortbread"]);
  expect(repo.usingTag(idOf("tag", "Weeknight")).map((recipe) => recipe.name)).toEqual(["Shortbread"]);
  expect(repo.usingTag(crypto.randomUUID())).toEqual([]);
});

test("deleting a recipe drops it from every usage list", () => {
  const shortbread = make("Shortbread", [{ quantity: 200, unit: gram, food: butter }], { tags: [baking] });
  make("Pancakes", [{ quantity: 100, unit: gram, food: flour }], { tags: [baking] });

  repo.remove(shortbread.id);
  expect(repo.usingFood(idOf("food", "butter"))).toEqual([]);
  expect(repo.usingTag(idOf("tag", "Baking")).map((recipe) => recipe.name)).toEqual(["Pancakes"]);
  expect(repo.usingUnit(idOf("unit", "gram")).map((recipe) => recipe.name)).toEqual(["Pancakes"]);
});
