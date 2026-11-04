import type { Recipe } from "./recipe";

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
