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
