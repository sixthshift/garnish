import { type ImportFile, parseJsonBytes } from "./file";
import { readMealieExport } from "./mealie/export";
import type { MealieRecipe } from "./mealie/types";
import { looksLikeTandoor } from "./tandoor/detect";
import { readNestedZip, readTandoorExport } from "./tandoor/export";
import type { TandoorRecipe } from "./tandoor/types";
import { isZip } from "./zip";

/** Either export's recipe: what the upload route answers with and the chooser reads. */
export type FileRecipe = MealieRecipe | TandoorRecipe;

/** Which export a recipe came out of. Pure. */
export function isTandoorRecipe(recipe: FileRecipe): recipe is TandoorRecipe {
  return recipe.source === "tandoor";
}

/**
 * The recipes in an uploaded export, whichever of the two it is. Told apart by
 * shape rather than by file name: both arrive as `.zip` or `.json`, and a
 * Tandoor recipe is the one with `steps`.
 */
export async function readExport(file: ImportFile): Promise<FileRecipe[]> {
  if (file.bytes.length === 0) throw new Error("That file is empty");

  if (!isZip(file.bytes)) {
    return looksLikeTandoor(parseJsonBytes(file.bytes)) ? await readTandoorExport(file) : await readMealieExport(file);
  }

  const entries = await readNestedZip(file.bytes);
  const tandoor = entries.some((entry) => {
    if (!entry.name.toLowerCase().endsWith(".json")) return false;
    try {
      return looksLikeTandoor(parseJsonBytes(entry.bytes));
    } catch {
      return false;
    }
  });
  return tandoor ? await readTandoorExport(file) : await readMealieExport(file);
}
