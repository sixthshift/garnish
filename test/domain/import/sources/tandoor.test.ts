// Reading a Tandoor export (M34.4). The task's Check is here: a fixture with
// two steps and a nested recipe — the parent has a Pastry step and a Filling
// step, and two more that stand in for other recipes, one of which comes with
// it in the export and one of which does not.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ingredientLines } from "../../../../src/domain/import/scraped";
import { imageDataUrl } from "../../../../src/domain/import/sources/mealie";
import {
  isTandoorRecipe,
  looksLikeTandoor,
  looksLikeTandoorRecipe,
  namesIn,
  partsFromTandoor,
  readExport,
  readNestedZip,
  readTandoorExport,
  reviewRowsFromTandoor,
  stepRecipeName,
  type TandoorRecipe,
  tandoorBundles,
  tandoorIngredient,
  tandoorRecipe,
  tandoorRecipesFrom,
} from "../../../../src/domain/import/sources/tandoor";
import type { Food } from "../../../../src/domain/reference";
import { makeZip, PNG_BYTES } from "../../../helpers/zip";

const dir = join(import.meta.dirname, "../../../fixtures/tandoor");
const parentPath = join(dir, "lemon-tart.json");
const childPath = join(dir, "lemon-curd.json");
const bytesOf = (path: string): Uint8Array => new Uint8Array(readFileSync(path));
const jsonOf = (path: string): Record<string, unknown> => JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
const parent = () => jsonOf(parentPath);
const child = () => jsonOf(childPath);
const utf8 = (text: string) => new TextEncoder().encode(text);

const gram = { name: "gram", pluralName: "grams", abbreviation: "g" };
const flour: Pick<Food, "name" | "pluralName" | "aliases"> = { name: "flour", pluralName: null, aliases: ["plain flour"] };
const lemon: Pick<Food, "name" | "pluralName" | "aliases"> = { name: "lemon", pluralName: "lemons", aliases: [] };
const vocabulary = { units: [gram], foods: [flour, lemon] };

/** The export as Tandoor writes a collection: a zip of one zip per recipe, each with its image. */
async function collectionZip(): Promise<Uint8Array> {
  const inner41 = await makeZip([
    { name: "recipe.json", bytes: bytesOf(parentPath), deflate: true },
    { name: "image.png", bytes: PNG_BYTES },
  ]);
  const inner42 = await makeZip([{ name: "recipe.json", bytes: bytesOf(childPath), deflate: true }]);
  return await makeZip([
    { name: "41.zip", bytes: inner41 },
    { name: "42.zip", bytes: inner42 },
  ]);
}

// --- The fixture -----------------------------------------------------------

describe("a Tandoor recipe.json", () => {
  const recipe = (): TandoorRecipe => tandoorRecipe(parent());

  test("the fields map straight across", () => {
    const read = recipe();
    expect(read.source).toBe("tandoor");
    expect(read.name).toBe("Lemon tart");
    expect(read.description).toBe("Sharp, set just enough to slice.");
    expect(read.servings).toBe(8);
    expect(read.yieldText).toBe("slices");
    // Working time is time at the bench, waiting time is time it takes care of itself.
    expect(read.prepMinutes).toBe(30);
    expect(read.cookMinutes).toBe(60);
    expect(read.sourceUrl).toBe("https://example.test/lemon-tart");
    expect(read.sourceId).toBe("41");
    expect(read.rating).toBeNull();
    expect(read.notes).toEqual([]);
  });

  test("keywords become tags, once each", () => {
    expect(recipe().tags).toEqual(["Baking", "Dessert"]);
  });

  test("a servings_text that only repeats the count is dropped", () => {
    expect(tandoorRecipe({ name: "x", steps: [], servings: 4, servings_text: "servings" }).yieldText).toBe("");
    expect(tandoorRecipe({ name: "x", steps: [], servings: 4, servings_text: "jars" }).yieldText).toBe("jars");
  });

  test("each step is a part, named by the step, blank ones the main body", () => {
    expect(recipe().parts.map((part) => part.name)).toEqual(["Pastry", "Filling", ""]);
  });

  test("a part's rows are the step's ingredients, linked to that step", () => {
    const [pastry, filling, body] = recipe().parts;
    expect(pastry!.rows.map((row) => row.originalText)).toEqual(["200 g plain flour, sifted", "100 gram butter, cold, cubed"]);
    // The same lines are the part's own (M36.2), which is what the review reads.
    expect(pastry!.ingredients).toEqual(["200 g plain flour, sifted", "100 gram butter, cold, cubed"]);
    expect(pastry!.steps).toEqual(["Rub the butter into the flour, then chill for 30 minutes and blind bake."]);
    expect(pastry!.stepRows).toEqual([[0, 1]]);

    expect(filling!.rows.map((row) => row.food)).toEqual(["lemon", "salt"]);
    expect(filling!.stepRows).toEqual([[0, 1]]);

    // The two blank-named steps fall together into the unnamed body, each
    // keeping its own row.
    expect(body!.steps).toHaveLength(2);
    expect(body!.stepRows).toEqual([[0], [1]]);
  });

  test("a no_amount row keeps its note and drops the meaningless amount", () => {
    const salt = recipe().parts[1]!.rows[1]!;
    expect(salt.quantity).toBeNull();
    expect(salt.note).toBe("a pinch");
  });
});

describe("a nested recipe", () => {
  test("the child in the same export becomes a food row standing for it", () => {
    const [tart] = tandoorRecipesFrom([parent(), child()]);
    const body = tart!.parts[2]!;
    const curd = body.rows[0]!;
    expect(curd.food).toBe("Lemon curd");
    expect(curd.recipeName).toBe("Lemon curd");
    expect(curd.originalText).toBe("Lemon curd");
  });

  test("a child that did not come with it is a text line naming it", () => {
    const [tart] = tandoorRecipesFrom([parent(), child()]);
    const peel = tart!.parts[2]!.rows[1]!;
    expect(peel.food).toBe("");
    expect(peel.recipeName).toBe("");
    expect(peel.originalText).toBe("Candied peel");
  });

  test("on its own, neither child is in the export, so both are text lines", () => {
    const rows = tandoorRecipe(parent()).parts[2]!.rows;
    expect(rows.map((row) => row.food)).toEqual(["", ""]);
  });

  test("stepRecipeName reads the data, a nested row, or a bare name", () => {
    expect(stepRecipeName({ step_recipe_data: { name: "Lemon curd" } })).toBe("Lemon curd");
    expect(stepRecipeName({ step_recipe: { name: "Lemon curd" } })).toBe("Lemon curd");
    expect(stepRecipeName({ step_recipe: "Lemon curd" })).toBe("Lemon curd");
    // An id with nothing to name it is not a recipe anyone could look up.
    expect(stepRecipeName({ step_recipe: 42 })).toBe("");
    expect(stepRecipeName({})).toBe("");
  });
});

// --- The pieces ------------------------------------------------------------

describe("tandoorIngredient", () => {
  test("the structured fields come across, and the line is rebuilt when there is none", () => {
    const row = tandoorIngredient({ food: { name: "flour" }, unit: { name: "gram" }, amount: 200, note: "sifted" });
    expect(row).toEqual({ originalText: "200 gram flour, sifted", quantity: 200, unit: "gram", food: "flour", note: "sifted", recipeName: "" });
  });

  test("original_text wins over the rebuilt line", () => {
    const row = tandoorIngredient({ food: { name: "flour" }, amount: 2, original_text: "2 handfuls of flour" });
    expect(row.originalText).toBe("2 handfuls of flour");
  });

  test("a row with no food is the note, kept as the line", () => {
    const row = tandoorIngredient({ food: null, unit: null, amount: 0, note: "Juice of a lemon" });
    expect(row.food).toBe("");
    expect(row.originalText).toBe("Juice of a lemon");
    expect(row.note).toBe("");
  });

  test("a header row is a text line, not a food", () => {
    const row = tandoorIngredient({ food: { name: "For the sauce" }, is_header: true, amount: 0 });
    expect(row.food).toBe("");
    expect(row.quantity).toBeNull();
    expect(row.originalText).toBe("For the sauce");
  });
});

describe("partsFromTandoor", () => {
  test("steps sharing a name are one part", () => {
    const parts = partsFromTandoor([
      { name: "Sauce", instruction: "Melt.", ingredients: [{ food: { name: "butter" }, amount: 50, unit: { name: "gram" } }] },
      { name: "Sauce", instruction: "Whisk.", ingredients: [{ food: { name: "flour" }, amount: 20, unit: { name: "gram" } }] },
    ]);
    expect(parts).toHaveLength(1);
    expect(parts[0]!.steps).toEqual(["Melt.", "Whisk."]);
    expect(parts[0]!.stepRows).toEqual([[0], [1]]);
  });

  test("a step with rows but nothing written keeps the rows and adds no step", () => {
    const parts = partsFromTandoor([{ name: "", instruction: "", ingredients: [{ food: { name: "flour" }, amount: 1 }] }]);
    expect(parts[0]!.rows).toHaveLength(1);
    expect(parts[0]!.ingredients).toEqual(["1 flour"]);
    expect(parts[0]!.steps).toEqual([]);
    expect(parts[0]!.stepRows).toEqual([]);
  });

  test("no steps at all still gives the unnamed body", () => {
    expect(partsFromTandoor([])).toEqual([{ name: "", ingredients: [], steps: [], rows: [], stepRows: [] }]);
  });
});

describe("telling a Tandoor file apart", () => {
  test("the fixture is one, and a Mealie recipe is not", () => {
    expect(looksLikeTandoorRecipe(parent())).toBe(true);
    expect(looksLikeTandoor([parent()])).toBe(true);
    expect(looksLikeTandoor({ recipes: [parent()] })).toBe(true);
    const mealie = jsonOf(join(import.meta.dirname, "../../../fixtures/mealie/lemon-tart.json"));
    expect(looksLikeTandoorRecipe(mealie)).toBe(false);
    expect(looksLikeTandoor(mealie)).toBe(false);
  });

  test("a name and steps are the minimum", () => {
    expect(looksLikeTandoorRecipe({ name: "x", steps: [], keywords: [] })).toBe(true);
    expect(looksLikeTandoorRecipe({ name: "x", steps: [{ instruction: "Mix." }] })).toBe(true);
    expect(looksLikeTandoorRecipe({ steps: [], keywords: [] })).toBe(false);
    expect(looksLikeTandoorRecipe({ name: "x" })).toBe(false);
    expect(looksLikeTandoorRecipe(null)).toBe(false);
  });

  test("namesIn is what decides a nested step's row", () => {
    expect([...namesIn([parent(), child()])]).toEqual(["lemon tart", "lemon curd"]);
  });

  test("isTandoorRecipe reads the discriminant the route round-trips", () => {
    expect(isTandoorRecipe(tandoorRecipe(parent()))).toBe(true);
  });
});

// --- A whole file ----------------------------------------------------------

describe("readTandoorExport", () => {
  test("a single recipe.json", async () => {
    const recipes = await readTandoorExport({ name: "recipe.json", bytes: bytesOf(parentPath) });
    expect(recipes).toHaveLength(1);
    expect(recipes[0]!.name).toBe("Lemon tart");
    expect(recipes[0]!.image).toBeNull();
  });

  test("one recipe's zip, with the image beside it", async () => {
    const zip = await makeZip([
      { name: "recipe.json", bytes: bytesOf(parentPath), deflate: true },
      { name: "image.png", bytes: PNG_BYTES },
    ]);
    const recipes = await readTandoorExport({ name: "Lemon tart.zip", bytes: zip });
    expect(recipes.map((recipe) => recipe.name)).toEqual(["Lemon tart"]);
    expect(recipes[0]!.image).toBe(imageDataUrl(PNG_BYTES));
  });

  test("a collection's zip of zips: both recipes, the images kept apart, the nested one resolved", async () => {
    const recipes = await readTandoorExport({ name: "export.zip", bytes: await collectionZip() });
    expect(recipes.map((recipe) => recipe.name)).toEqual(["Lemon tart", "Lemon curd"]);
    expect(recipes[0]!.image).toMatch(/^data:image\/png;base64,/);
    expect(recipes[1]!.image).toBeNull();
    // The child came with it, so the parent's nested row stands for it.
    expect(recipes[0]!.parts[2]!.rows[0]!.recipeName).toBe("Lemon curd");
  });

  test("what it refuses", async () => {
    await expect(readTandoorExport({ name: "empty.json", bytes: new Uint8Array() })).rejects.toThrow("empty");
    await expect(readTandoorExport({ name: "notes.txt", bytes: utf8("hello") })).rejects.toThrow("not JSON or a zip");
    await expect(readTandoorExport({ name: "other.json", bytes: utf8('{"hello":true}') })).rejects.toThrow("No Tandoor recipe");
    const zip = await makeZip([{ name: "settings.json", bytes: utf8('{"name":"Home"}') }]);
    await expect(readTandoorExport({ name: "export.zip", bytes: zip })).rejects.toThrow("No Tandoor recipes in that zip");
  });
});

describe("readNestedZip and tandoorBundles", () => {
  test("the inner zips are unpacked under their own names", async () => {
    const entries = await readNestedZip(await collectionZip());
    expect(entries.map((entry) => entry.name)).toEqual(["41.zip/recipe.json", "41.zip/image.png", "42.zip/recipe.json"]);
  });

  test("each recipe.json finds the image in its own folder", async () => {
    const bundles = tandoorBundles(await readNestedZip(await collectionZip()));
    expect(bundles.map((bundle) => bundle.json.name)).toEqual(["41.zip/recipe.json", "42.zip/recipe.json"]);
    expect(bundles[0]!.image?.name).toBe("41.zip/image.png");
    expect(bundles[1]!.image).toBeNull();
  });
});

describe("readExport tells the two exports apart by shape", () => {
  test("a Tandoor file goes to the Tandoor parser", async () => {
    const recipes = await readExport({ name: "recipe.json", bytes: bytesOf(parentPath) });
    expect(recipes[0]!.source).toBe("tandoor");
    const zipped = await readExport({ name: "export.zip", bytes: await collectionZip() });
    expect(zipped.map((recipe) => recipe.source)).toEqual(["tandoor", "tandoor"]);
  });

  test("a Mealie file still goes to the Mealie parser", async () => {
    const mealie = readFileSync(join(import.meta.dirname, "../../../fixtures/mealie/lemon-tart.json"));
    const recipes = await readExport({ name: "lemon-tart.json", bytes: new Uint8Array(mealie) });
    expect(recipes[0]!.source).toBe("mealie");
    const zip = await makeZip([{ name: "database.json", bytes: new Uint8Array(mealie), deflate: true }]);
    const zipped = await readExport({ name: "backup.zip", bytes: zip });
    expect(zipped.map((recipe) => recipe.source)).toEqual(["mealie"]);
  });

  test("an empty file says so before either parser looks at it", async () => {
    await expect(readExport({ name: "empty.json", bytes: new Uint8Array() })).rejects.toThrow("empty");
  });
});

// --- On to the review ------------------------------------------------------

describe("reviewRowsFromTandoor", () => {
  test("every row, in part order, with its step and the nested recipes it named", () => {
    const [tart] = tandoorRecipesFrom([parent(), child()]);
    const { rows, rowSteps, subRecipeNames } = reviewRowsFromTandoor(tart!, vocabulary);

    expect(rows.map((row) => row.key)).toEqual(["0", "1", "2", "3", "4", "5"]);
    // The rows come out in the order the parts' own lines are in, which is how
    // the draft puts each one back on its part (M36.2).
    expect(rows.map((row) => row.originalText)).toEqual(ingredientLines(tart!));
    // The two body rows sit under one step each, in step order.
    expect(rowSteps).toEqual([0, 0, 0, 0, 0, 1]);
    expect(subRecipeNames).toEqual(["Lemon curd"]);

    // Matched against the vocabulary by name, as Mealie's rows are.
    expect(rows[0]!.food).toEqual({ kind: "existing", row: flour });
    expect(rows[0]!.unit).toEqual({ kind: "existing", row: gram });
    expect(rows[0]!.quantity).toBe(200);
    // Butter is not in the vocabulary, so it is a proposal, not a creation.
    expect(rows[1]!.food).toEqual({ kind: "none" });
    expect(rows[1]!.foodText).toBe("butter");
    // The nested child is offered as a food to create; the missing one is a
    // plain line, parsed like any other text row and named by nothing but
    // itself, so it is not in `subRecipeNames` and nothing will link it.
    expect(rows[4]!.originalText).toBe("Lemon curd");
    expect(rows[4]!.foodText).toBe("Lemon curd");
    expect(rows[5]!.originalText).toBe("Candied peel");
    expect(rows[5]!.food).toEqual({ kind: "none" });
  });
});
