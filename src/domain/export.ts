// Export's pure half (M34.1): the shape of the file and the one thing the
// documents are rewritten for on the way out — the image.
//
// A stored recipe carries `image` as a bare file name ("<id>.jpg"), which is
// only meaningful to something holding the same DATA_DIR. An export is read
// somewhere else, so the file name becomes the URL that serves it. The bytes
// themselves are not in the file (decisions.md row 72); the URL is the pointer
// back to them.
import type { Recipe } from "./recipe";

/** Bumped when the envelope's shape changes, not when a recipe field is added. */
export const EXPORT_VERSION = 1;

/** Where `handleGetImage` serves a recipe image from. */
export const IMAGE_URL_PREFIX = "/api/images/";

/** A stored image file name as the URL that serves it. Null stays null. */
export function imageUrl(file: string | null): string | null {
  const name = file?.trim() ?? "";
  return name === "" ? null : `${IMAGE_URL_PREFIX}${name}`;
}

/** The document as it leaves the app: unchanged but for the image URL. */
export function exportedRecipe(recipe: Recipe): Recipe {
  return { ...recipe, image: imageUrl(recipe.image) };
}

/** The name the browser saves the whole-database export under. */
export function exportFileName(at: Date): string {
  return `garnish-export-${at.toISOString().slice(0, 10)}.json`;
}
