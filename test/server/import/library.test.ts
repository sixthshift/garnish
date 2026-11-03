// A whole Mealie or Tandoor export brought in from Settings › Backup (decisions.md row 201): every recipe
// saved without a review, foods matched or made, recipes already here skipped, nested Tandoor recipes linked.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import foods from "../../../src/db/models/food/repo";
import recipes from "../../../src/db/models/recipe/repo";
import { type FileRecipe, Importer } from "../../../src/domain/import";
import { handleImportLibrary, IMPORT_FIELD } from "../../../src/server/api/importFile";
import { checkLibrary, childrenFirst, importLibrary } from "../../../src/server/import/library";
import { useTempDataDir } from "../../helpers/server";
import { makeZip, PNG_BYTES } from "../../helpers/zip";

useTempDataDir();

const FIXTURES = join(import.meta.dirname, "../../fixtures");
const unreachable = () => Promise.reject(new Error("not reached"));
const files = new Importer({ fetchPage: unreachable, model: unreachable });
const read = (name: string, bytes: Uint8Array) => files.import({ kind: "file", file: { name, bytes } });

/** A Mealie backup of the lemon tart, with its picture, and a pancake recipe. */
async function mealieBackup(): Promise<Uint8Array> {
  const tart = JSON.parse(readFileSync(join(FIXTURES, "mealie/lemon-tart.json"), "utf8")) as { id: string; name: string };
  return makeZip([
    { name: "database.json", bytes: new TextEncoder().encode(JSON.stringify({ recipes: [tart, { ...tart, id: "other", name: "Pancakes", orgURL: "" }] })) },
    { name: `data/recipes/${tart.id}/images/original.png`, bytes: PNG_BYTES },
  ]);
}

/** Tandoor's tart, which nests the curd, listed before the curd. */
function tandoorExport(): Promise<FileRecipe[]> {
  const one = (name: string) => JSON.parse(readFileSync(join(FIXTURES, "tandoor", name), "utf8")) as unknown;
  return read("tandoor.json", new TextEncoder().encode(JSON.stringify([one("lemon-tart.json"), one("lemon-curd.json")])));
}

test("every recipe is saved, its foods made once and its picture kept", async () => {
  const found = await read("backup.zip", await mealieBackup());
  const report = await importLibrary(found);

  expect(report.imported.map((recipe) => recipe.name)).toEqual(["Lemon tart", "Pancakes"]);
  expect(report.skipped).toEqual([]);
  expect(report.failed).toEqual([]);
  expect(report.foodsCreated).toBeGreaterThan(0);

  const tart = recipes.get(report.imported[0]!.slug)!;
  expect(tart.image).toMatch(/\.png$/);
  // A food the export names is made, and its rows point at it rather than standing as text.
  const rows = tart.parts.flatMap((part) => part.ingredients);
  expect(rows.some((row) => row.food !== null)).toBe(true);
  // The second recipe found the first's foods: none of them twice.
  const names = foods.list().map((food) => food.name.toLowerCase());
  expect(new Set(names).size).toBe(names.length);
});

test("a second run adds nothing: what is here is left alone", async () => {
  const found = await read("backup.zip", await mealieBackup());
  await importLibrary(found);
  const before = foods.list().length;

  expect(checkLibrary(found)).toMatchObject({ recipes: 2, alreadyHere: 2 });
  const again = await importLibrary(found);
  expect(again.imported).toEqual([]);
  expect(again.skipped.map((recipe) => recipe.name)).toEqual(["Lemon tart", "Pancakes"]);
  expect(again.foodsCreated).toBe(0);
  expect(foods.list()).toHaveLength(before);
});

test("a nested Tandoor recipe is saved first, and the parent's row is the food that is that recipe", async () => {
  const found = await tandoorExport();
  expect(childrenFirst(found).map((recipe) => recipe.name)).toEqual(["Lemon curd", "Lemon tart"]);

  const report = await importLibrary(found);
  expect(report.imported.map((recipe) => recipe.name)).toEqual(["Lemon curd", "Lemon tart"]);
  const curd = recipes.get(report.imported[0]!.slug)!;
  const tart = recipes.get(report.imported[1]!.slug)!;
  const curdRow = tart.parts.flatMap((part) => part.ingredients).find((row) => row.food?.name.toLowerCase() === "lemon curd");
  expect(curdRow?.food?.recipeId).toBe(curd.id);
});

test("the route's check counts and writes nothing; without it, it imports", async () => {
  const upload = async (url: string) => {
    const form = new FormData();
    form.append(IMPORT_FIELD, new File([(await mealieBackup()) as BlobPart], "backup.zip", { type: "application/zip" }));
    return handleImportLibrary(new Request(url, { method: "POST", body: form }));
  };

  const checked = await upload("http://localhost/api/import/library?check=1");
  expect(await checked.json()).toEqual({ recipes: 2, alreadyHere: 0, names: ["Lemon tart", "Pancakes"] });
  expect(recipes.query()).toHaveLength(0);

  const done = await upload("http://localhost/api/import/library");
  expect(done.status).toBe(200);
  expect(((await done.json()) as { imported: unknown[] }).imported).toHaveLength(2);
  expect(recipes.query()).toHaveLength(2);
});
