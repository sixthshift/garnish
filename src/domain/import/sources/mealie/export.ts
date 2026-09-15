import { type ImportFile, imageDataUrl, parseJsonBytes } from "../file";
import { isZip, readZip, type ZipEntry } from "../zip";
import { mealieRecipesFrom } from "./database";
import type { MealieRecipe } from "./types";

/** The image a backup holds for a recipe id: `data/recipes/<id>/images/original.*`, else any image under that folder. Pure. */
export function imageForRecipe(entries: readonly ZipEntry[], recipeId: string): string | null {
  if (recipeId === "") return null;
  const prefix = `recipes/${recipeId.toLowerCase()}/images/`;
  const mine = entries.filter((entry) => entry.name.toLowerCase().includes(prefix));
  const best = mine.find((entry) => /\/original\.[^/]+$/i.test(entry.name)) ?? mine[0];
  return best === undefined ? null : imageDataUrl(best.bytes);
}

/**
 * The recipes in an uploaded Mealie export: a recipe JSON, or a backup zip
 * with its images attached. Throws with a message meant for the import screen.
 * No IO — the bytes are the caller's.
 */
export async function readMealieExport(file: ImportFile): Promise<MealieRecipe[]> {
  if (file.bytes.length === 0) throw new Error("That file is empty");

  if (!isZip(file.bytes)) {
    const recipes = mealieRecipesFrom(parseJsonBytes(file.bytes));
    if (recipes.length === 0) throw new Error("No Mealie recipe in that file");
    return recipes;
  }

  const entries = await readZip(file.bytes);
  const jsonEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith(".json"));
  // `database.json` first: a backup's other JSON files are settings and groups.
  jsonEntries.sort((a, b) => Number(b.name.toLowerCase().endsWith("database.json")) - Number(a.name.toLowerCase().endsWith("database.json")));

  const recipes: MealieRecipe[] = [];
  for (const entry of jsonEntries) {
    let found: MealieRecipe[];
    try {
      found = mealieRecipesFrom(parseJsonBytes(entry.bytes));
    } catch {
      continue; // a JSON file in the backup that is not recipes
    }
    recipes.push(...found);
  }
  if (recipes.length === 0) throw new Error("No Mealie recipes in that zip");

  return recipes.map((recipe) => ({ ...recipe, image: imageForRecipe(entries, recipe.sourceId) }));
}
