// Client-side image helpers. The recipe row stores only the file name (see
// imageFileName in src/domain/image.ts); GET /api/images/:file serves it and
// POST /api/recipes/:id/image replaces it.
import { IMAGE_FIELD } from "../domain/image";

/** Multipart field the upload routes read. Re-exported so callers of this module need only one import. */
export { IMAGE_FIELD } from "../domain/image";

/** The URL that serves a recipe's stored image, or null when it has none. Pure. */
export function recipeImageUrl(image: string | null | undefined): string | null {
  if (!image) return null;
  return `/api/images/${encodeURIComponent(image)}`;
}

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

/** The URL that serves a timeline photo, or null when the event has none. Pure. */
export function timelineImageUrl(image: string | null | undefined): string | null {
  if (!image) return null;
  return `/api/images/timeline/${encodeURIComponent(image)}`;
}

/** The photo upload endpoint for a logged cook. Pure. */
export function timelineImageUploadUrl(eventId: string): string {
  return `/api/timeline/${encodeURIComponent(eventId)}/image`;
}

/**
 * POST `file` as a logged cook's photo. Resolves with the stored file name;
 * rejects with the server's `error` text on a non-2xx.
 */
export async function uploadTimelineImage(eventId: string, file: File, fetcher: Fetcher = fetch): Promise<string> {
  const body = new FormData();
  body.append(IMAGE_FIELD, file);
  const response = await fetcher(timelineImageUploadUrl(eventId), { method: "POST", body });
  const payload = (await response.json().catch(() => ({}))) as { image?: string; error?: string };
  if (!response.ok) throw new Error(payload.error ?? `photo upload failed (${response.status})`);
  if (typeof payload.image !== "string") throw new Error("photo upload returned no file name");
  return payload.image;
}

/** The URL that serves a step's photo, or null when the step has none (M35.1). Pure. */
export function stepImageUrl(image: string | null | undefined): string | null {
  if (!image) return null;
  return `/api/images/steps/${encodeURIComponent(image)}`;
}

/** The photo upload endpoint for a step. Pure. */
export function stepImageUploadUrl(stepId: string): string {
  return `/api/steps/${encodeURIComponent(stepId)}/image`;
}

/**
 * POST `file` as a step's photo. Resolves with the stored file name; rejects
 * with the server's `error` text on a non-2xx — a step the recipe has never
 * saved is a 404 there, so the editor asks for a save first.
 */
export async function uploadStepImage(stepId: string, file: File, fetcher: Fetcher = fetch): Promise<string> {
  const body = new FormData();
  body.append(IMAGE_FIELD, file);
  const response = await fetcher(stepImageUploadUrl(stepId), { method: "POST", body });
  const payload = (await response.json().catch(() => ({}))) as { image?: string; error?: string };
  if (!response.ok) throw new Error(payload.error ?? `photo upload failed (${response.status})`);
  if (typeof payload.image !== "string") throw new Error("photo upload returned no file name");
  return payload.image;
}

/** What `fetchImage` (src/server/imageFetch.ts) answers with, as the client needs it. */
export type FetchedImageData = { base64: string; contentType: string; name: string };

/** Decode base64 to bytes. Pure; throws on characters that are not base64. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * A `data:` URL as a File. An image out of an uploaded Mealie backup (M34.3)
 * arrives as bytes, not an address, so it comes back from the parser as a data
 * URL and is rebuilt here rather than fetched. Pure; throws on anything that
 * is not a base64 data URL.
 */
export function dataUrlFile(url: string, name = "image"): File {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(url.trim());
  if (match === null) throw new Error("that is not a base64 data URL");
  const contentType = match[1]!;
  const ext = contentType.split("/")[1] ?? "bin";
  return new File([base64ToBytes(match[2]!) as BlobPart], `${name}.${ext.replace("jpeg", "jpg")}`, { type: contentType });
}

/** Rebuild a fetched image as a File, so a pasted URL joins the same upload path as a picked file. */
export function fetchedImageFile(data: FetchedImageData): File {
  return new File([base64ToBytes(data.base64) as BlobPart], data.name, { type: data.contentType });
}
