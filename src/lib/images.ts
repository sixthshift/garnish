// Client-side image helpers. The recipe row stores only the file name (see
// src/server/images.ts, imageFileName); GET /api/images/:file serves it and
// POST /api/recipes/:id/image replaces it.

/** The URL that serves a recipe's stored image, or null when it has none. Pure. */
export function recipeImageUrl(image: string | null | undefined): string | null {
  if (!image) return null;
  return `/api/images/${encodeURIComponent(image)}`;
}

/** Multipart field the upload route reads. Mirrors IMAGE_FIELD in src/server/images.ts (server-only, so not imported). */
export const IMAGE_FIELD = "image";

/** The upload endpoint for a recipe. Pure. */
export function recipeImageUploadUrl(recipeId: string): string {
  return `/api/recipes/${encodeURIComponent(recipeId)}/image`;
}

/** The slice of `fetch` the upload uses; injectable for tests. */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * POST `file` as the recipe's image. Resolves with the stored file name the
 * server answers with; rejects with the server's `error` text on a non-2xx.
 */
export async function uploadRecipeImage(recipeId: string, file: File, fetcher: Fetcher = fetch): Promise<string> {
  const body = new FormData();
  body.append(IMAGE_FIELD, file);
  const response = await fetcher(recipeImageUploadUrl(recipeId), { method: "POST", body });
  const payload = (await response.json().catch(() => ({}))) as { image?: string; error?: string };
  if (!response.ok) throw new Error(payload.error ?? `image upload failed (${response.status})`);
  if (typeof payload.image !== "string") throw new Error("image upload returned no file name");
  return payload.image;
}
