// Reading a Mealie export (M34.3). The task's Checks are here: a fixture in
// Mealie's documented format with sections, and a `title` becoming a part.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  ingredientLine,
  imageDataUrl,
  imageForRecipe,
  looksLikeMealieRecipe,
  matchFood,
  matchUnit,
  mealieIngredient,
  mealieRecipe,
  mealieRecipesFrom,
  mealieTimeToMinutes,
  partsFromMealie,
  readMealieExport,
  recipesFromDatabase,
  reviewRowFromMealie,
  reviewRowsFromMealie,
  tagNames,
  type MealieRecipe,
} from "../../../../src/domain/import/sources/mealie";
import type { Food } from "../../../../src/domain/recipe/recipe";
import { ingredientLines } from "../../../../src/domain/import/scraped";
import { makeZip, PNG_BYTES } from "../../../helpers/zip";

const FIXTURE = join(import.meta.dirname, "../../../fixtures/mealie/lemon-tart.json");
const fixtureBytes = (): Uint8Array => new Uint8Array(readFileSync(FIXTURE));
const fixture = (): Record<string, unknown> => JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, unknown>;
const utf8 = (text: string) => new TextEncoder().encode(text);

const gram = { name: "gram", pluralName: "grams", abbreviation: "g" };
const flour: Pick<Food, "name" | "pluralName" | "aliases"> = { name: "flour", pluralName: null, aliases: ["plain flour"] };
const lemon: Pick<Food, "name" | "pluralName" | "aliases"> = { name: "lemon", pluralName: "lemons", aliases: [] };
const vocabulary = { units: [gram], foods: [flour, lemon] };

// --- The fixture -----------------------------------------------------------

describe("a Mealie recipe JSON with sections", () => {
  const recipe = (): MealieRecipe => mealieRecipe(fixture());

  test("the fields map straight across", () => {
    const read = recipe();
    expect(read.name).toBe("Lemon tart");
    expect(read.description).toBe("Sharp, set just enough to slice.");
    expect(read.servings).toBe(8);
    expect(read.yieldText).toBe("tart");
    expect(read.prepMinutes).toBe(30);
    expect(read.cookMinutes).toBe(60);
    expect(read.rating).toBe(5);
    expect(read.sourceUrl).toBe("https://example.test/lemon-tart");
    expect(read.notes).toEqual([{ title: "Tip", text: "Use a hot knife to slice it." }]);
  });

  test("tags and categories both become tags, once each", () => {
    expect(recipe().tags).toEqual(["Baking", "Dessert"]);
  });

  test("a title becomes a part, and the rows before it stay on the main body", () => {
    const parts = recipe().parts;
    expect(parts.map((part) => part.name)).toEqual(["Pastry", "Filling", "To finish"]);
    expect(parts[0]!.rows.map((row) => row.food)).toEqual(["flour", "butter"]);
    expect(parts[1]!.rows.map((row) => row.food)).toEqual(["lemon", ""]);
    // The part owns the lines themselves too (M36.2), which is what the review reads.
    expect(parts[0]!.ingredients).toEqual(["200 g plain flour, sifted", "100 g cold butter, cubed"]);
  });

  test("an instruction title joins the ingredient section of the same name", () => {
    const parts = recipe().parts;
    expect(parts[0]!.steps).toEqual(["Rub the butter into the flour.", "Chill for 30 minutes, then blind bake."]);
    expect(parts[1]!.steps).toEqual(["Whisk the lemons with the eggs and sugar."]);
    // A section only the instructions name still becomes a part of its own.
    expect(parts[2]).toEqual({ name: "To finish", ingredients: [], steps: ["Bake until barely set."], rows: [] });
  });

  test("food, unit, quantity and note come across, and originalText is kept", () => {
    const row = recipe().parts[0]!.rows[0]!;
    expect(row).toEqual({ originalText: "200 g plain flour, sifted", quantity: 200, unit: "gram", food: "flour", note: "sifted" });
  });

  test("a row Mealie never structured keeps its line and nothing else", () => {
    const row = recipe().parts[1]!.rows[1]!;
    expect(row).toEqual({ originalText: "A pinch of sea salt", quantity: null, unit: "", food: "", note: "" });
  });

  test("every line is on its part, and flat across them for the review's count", () => {
    expect(ingredientLines(recipe())).toEqual([
      "200 g plain flour, sifted",
      "100 g cold butter, cubed",
      "4 lemons, juiced",
      "A pinch of sea salt",
    ]);
  });
});

// --- The pieces ------------------------------------------------------------

describe("times", () => {
  test.each([
    ["30 Minutes", 30],
    ["1 Hour", 60],
    ["1 Hour 30 Minutes", 90],
    ["PT1H30M", 90],
    ["45", 45],
    ["2 days", 2880],
    ["90 secs", 2],
    ["", null],
    [null, null],
    ["soon", null],
  ])("%s is %s minutes", (value, minutes) => {
    expect(mealieTimeToMinutes(value)).toBe(minutes);
  });
});

test("tagNames takes rows or bare strings, once each, in order", () => {
  expect(tagNames([{ name: "Baking" }, { name: "baking" }, { name: "" }], ["Dessert", "Dessert"], null)).toEqual(["Baking", "Dessert"]);
});

test("ingredientLine spells out a row Mealie displayed nothing for", () => {
  expect(mealieIngredient({ quantity: 2, unit: { name: "cup" }, food: { name: "flour" }, note: "sifted" }).originalText).toBe("2 cup flour, sifted");
  expect(ingredientLine({ originalText: "", quantity: null, unit: "", food: "salt", note: "" })).toBe("salt");
});

test("partsFromMealie always returns at least the unnamed body", () => {
  expect(partsFromMealie([], [])).toEqual([{ name: "", ingredients: [], steps: [], rows: [] }]);
  const parts = partsFromMealie([{ food: { name: "flour" } }], [{ text: "Mix." }, { text: "   " }]);
  expect(parts).toHaveLength(1);
  expect(parts[0]!.name).toBe("");
  expect(parts[0]!.steps).toEqual(["Mix."]);
});

test("matchFood and matchUnit resolve by name, plural, alias and abbreviation", () => {
  expect(matchFood("Lemons", vocabulary.foods)).toBe(lemon);
  expect(matchFood("plain flour", vocabulary.foods)).toBe(flour);
  expect(matchFood("saffron", vocabulary.foods)).toBeNull();
  expect(matchUnit("g", vocabulary.units)).toBe(gram);
  expect(matchUnit("grams", vocabulary.units)).toBe(gram);
  expect(matchUnit("cup", vocabulary.units)).toBeNull();
});

// --- On to the review ------------------------------------------------------

describe("review rows", () => {
  test("a structured row arrives matched, with its amount and note", () => {
    const row = reviewRowFromMealie({ originalText: "200 g plain flour, sifted", quantity: 200, unit: "gram", food: "flour", note: "sifted" }, "0", vocabulary);
    expect(row).toMatchObject({
      key: "0",
      originalText: "200 g plain flour, sifted",
      quantity: 200,
      note: "sifted",
      unit: { kind: "existing", row: gram },
      food: { kind: "existing", row: flour },
    });
  });

  test("a food this app does not have is proposed, not created", () => {
    const row = reviewRowFromMealie({ originalText: "100 g butter", quantity: 100, unit: "gram", food: "butter", note: "" }, "1", vocabulary);
    expect(row.food).toEqual({ kind: "none" });
    expect(row.foodText).toBe("butter");
    expect(row.unit).toEqual({ kind: "existing", row: gram });
  });

  test("a row with no food at all is parsed like a pasted line", () => {
    const row = reviewRowFromMealie({ originalText: "4 lemons, juiced", quantity: null, unit: "", food: "", note: "" }, "2", vocabulary);
    expect(row.food).toEqual({ kind: "existing", row: lemon });
    expect(row.quantity).toBe(4);
  });

  test("the rows come out in part order, the same order the parts' own lines are in", () => {
    const source = mealieRecipe(fixture());
    const { rows } = reviewRowsFromMealie(source, vocabulary);
    expect(rows.map((row) => row.key)).toEqual(["0", "1", "2", "3"]);
    expect(rows.map((row) => row.originalText)).toEqual(ingredientLines(source));
  });
});

// --- Whole files -----------------------------------------------------------

describe("mealieRecipesFrom", () => {
  test("one recipe, a list of them, or a wrapper", () => {
    const node = fixture();
    expect(mealieRecipesFrom(node)).toHaveLength(1);
    expect(mealieRecipesFrom([node, node])).toHaveLength(2);
    expect(mealieRecipesFrom({ recipes: [node] })).toHaveLength(1);
    expect(mealieRecipesFrom({ nothing: true })).toEqual([]);
  });

  test("looksLikeMealieRecipe needs a name and one of the lists", () => {
    expect(looksLikeMealieRecipe({ name: "x", recipeIngredient: [] })).toBe(true);
    expect(looksLikeMealieRecipe({ name: "x" })).toBe(false);
    expect(looksLikeMealieRecipe({ recipeIngredient: [] })).toBe(false);
  });

  test("a backup's flat tables are joined into the same shape", () => {
    const db = {
      recipes: [{ id: "r1", name: "Flatbread", recipe_servings: 2, prep_time: "10 Minutes", org_url: "https://example.test/flatbread" }],
      recipes_ingredients: [
        { id: "i2", recipe_id: "r1", position: 2, quantity: 1, unit_id: null, food_id: "f2", note: "", original_text: "1 bay leaf", title: "Dough" },
        { id: "i1", recipe_id: "r1", position: 1, quantity: 200, unit_id: "u1", food_id: "f1", note: "", original_text: "200 g flour", title: "Dough" },
      ],
      recipe_instructions: [{ id: "s1", recipe_id: "r1", position: 1, title: "", text: "Mix." }],
      ingredient_foods: [
        { id: "f1", name: "flour" },
        { id: "f2", name: "bay leaf" },
      ],
      ingredient_units: [{ id: "u1", name: "gram", abbreviation: "g" }],
      tags: [{ id: "t1", name: "Weeknight" }],
      recipes_to_tags: [{ recipe_id: "r1", tag_id: "t1" }],
      notes: [{ recipe_id: "r1", title: "", text: "Rest the dough." }],
    };
    expect(recipesFromDatabase(db)).toHaveLength(1);
    const [recipe] = mealieRecipesFrom(db);
    expect(recipe!.name).toBe("Flatbread");
    expect(recipe!.servings).toBe(2);
    expect(recipe!.prepMinutes).toBe(10);
    expect(recipe!.tags).toEqual(["Weeknight"]);
    expect(recipe!.notes).toEqual([{ title: "", text: "Rest the dough." }]);
    // Ordered by `position`, with the food and unit joined in and the title as a part.
    expect(recipe!.parts).toHaveLength(1);
    expect(recipe!.parts[0]!.name).toBe("Dough");
    expect(recipe!.parts[0]!.rows.map((row) => [row.food, row.unit])).toEqual([
      ["flour", "gram"],
      ["bay leaf", ""],
    ]);
    expect(recipe!.parts[0]!.steps).toEqual(["Mix."]);
  });
});

describe("readMealieExport", () => {
  test("a single recipe JSON", async () => {
    const recipes = await readMealieExport({ name: "lemon-tart.json", bytes: fixtureBytes() });
    expect(recipes).toHaveLength(1);
    expect(recipes[0]!.name).toBe("Lemon tart");
    // No zip, so no image bytes to attach.
    expect(recipes[0]!.image).toBeNull();
  });

  test("a backup zip, with the recipe's image out of the archive", async () => {
    const id = String(fixture().id);
    const zip = await makeZip([
      { name: "database.json", bytes: utf8(JSON.stringify({ recipes: [fixture()] })), deflate: true },
      { name: `data/recipes/${id}/images/original.png`, bytes: PNG_BYTES },
      { name: "data/groups/settings.json", bytes: utf8('{"name":"Home"}') },
    ]);
    const recipes = await readMealieExport({ name: "backup.zip", bytes: zip });
    expect(recipes).toHaveLength(1);
    expect(recipes[0]!.name).toBe("Lemon tart");
    expect(recipes[0]!.image).toBe(imageDataUrl(PNG_BYTES));
    expect(recipes[0]!.image).toMatch(/^data:image\/png;base64,/);
  });

  test("a Tandoor export is not read as a Mealie one (M34.4 reads it; `readExport` dispatches)", async () => {
    const tandoor = { name: "Flatbread", keywords: [{ name: "quick" }], working_time: 10, steps: [{ instruction: "Mix.", ingredients: [] }] };
    await expect(readMealieExport({ name: "flatbread.json", bytes: utf8(JSON.stringify(tandoor)) })).rejects.toThrow("No Mealie recipe");
    expect(mealieRecipesFrom(tandoor)).toEqual([]);
  });

  test("what it refuses", async () => {
    await expect(readMealieExport({ name: "empty.json", bytes: new Uint8Array() })).rejects.toThrow("empty");
    await expect(readMealieExport({ name: "notes.txt", bytes: utf8("hello") })).rejects.toThrow("not JSON or a zip");
    await expect(readMealieExport({ name: "other.json", bytes: utf8('{"hello":true}') })).rejects.toThrow("No Mealie recipe");
    const zip = await makeZip([{ name: "settings.json", bytes: utf8('{"name":"Home"}') }]);
    await expect(readMealieExport({ name: "backup.zip", bytes: zip })).rejects.toThrow("No Mealie recipes in that zip");
  });
});

test("imageForRecipe prefers original.* and ignores other recipes' folders", () => {
  const entries = [
    { name: "data/recipes/other/images/original.png", bytes: PNG_BYTES },
    { name: "data/recipes/abc/images/min-original.webp", bytes: utf8("not an image") },
    { name: "data/recipes/abc/images/original.png", bytes: PNG_BYTES },
  ];
  expect(imageForRecipe(entries, "abc")).toBe(imageDataUrl(PNG_BYTES));
  expect(imageForRecipe(entries, "")).toBeNull();
  expect(imageForRecipe(entries, "missing")).toBeNull();
  expect(imageDataUrl(utf8("not an image"))).toBeNull();
});
