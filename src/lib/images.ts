// Client-side image helpers. The recipe row stores only the file name (see
// src/server/images.ts, imageFileName); GET /api/images/:file serves it.

/** The URL that serves a recipe's stored image, or null when it has none. Pure. */
export function recipeImageUrl(image: string | null | undefined): string | null {
  if (!image) return null;
  return `/api/images/${encodeURIComponent(image)}`;
}
