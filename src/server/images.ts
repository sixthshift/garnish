// Server-only. Recipe images on disk: one file per recipe under
// `<DATA_DIR>/images/<recipeId>.<ext>`, the file name mastered in `recipe.image`.
// The two /api routes call the handlers here; the small helpers are pure.
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { recipes } from "../db/recipes";
import { dataDir } from "./boot";
import { getDb } from "./db";

/** Accepted formats, by the extension the file is stored under. */
export const IMAGE_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
} as const;

export type ImageExtension = keyof typeof IMAGE_TYPES;

/** Multipart field the upload arrives in. Mealie's is `image` too. */
export const IMAGE_FIELD = "image";

/** Largest upload accepted, in bytes. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const RECIPE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_FILE = /^([0-9a-f-]{36})\.(png|jpg|webp|gif)$/i;

/** `<root>/images`; root defaults to the resolved DATA_DIR. */
export function imagesDir(root: string = dataDir()): string {
  return join(root, "images");
}

function startsWith(bytes: Uint8Array, prefix: number[], at = 0): boolean {
  if (bytes.length < at + prefix.length) return false;
  return prefix.every((b, i) => bytes[at + i] === b);
}

const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

/** Format from the magic bytes, or null for anything that is not png/jpeg/webp/gif. Pure. */
export function sniffImage(bytes: Uint8Array): ImageExtension | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))) return "gif";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "webp";
  return null;
}

/** The stored file name for a recipe's image. Pure. */
export function imageFileName(recipeId: string, ext: ImageExtension): string {
  return `${recipeId}.${ext}`;
}

/**
 * Content type for a file name this server hands out, or null when the name
 * is not `<uuid>.<ext>`. Anything with a separator, `..` or an unknown
 * extension is null, so a null here is the path-traversal guard. Pure.
 */
export function imageContentType(file: string): string | null {
  const match = IMAGE_FILE.exec(file);
  if (!match) return null;
  return IMAGE_TYPES[match[2]!.toLowerCase() as ImageExtension];
}

/**
 * Write `bytes` as the recipe's image and delete any earlier file for that
 * recipe with a different extension. Returns the new file name.
 */
export async function storeImage(recipeId: string, ext: ImageExtension, bytes: Uint8Array, dir: string = imagesDir()): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const name = imageFileName(recipeId, ext);
  await Bun.write(join(dir, name), bytes);
  for (const existing of readdirSync(dir)) {
    if (existing !== name && existing.toLowerCase().startsWith(`${recipeId.toLowerCase()}.`)) unlinkSync(join(dir, existing));
  }
  return name;
}

const badRequest = (error: string): Response => Response.json({ error }, { status: 400 });
const notFound = (error: string): Response => Response.json({ error }, { status: 404 });

/**
 * POST /api/recipes/:id/image — multipart body with the file in the `image`
 * field. Stores it, points `recipe.image` at the file and answers
 * `{ image: "<id>.<ext>" }`, Mealie's shape. 404 for an unknown recipe, 400
 * for a missing, oversized or non-image file.
 */
export async function handleUploadImage(request: Request, recipeId: string): Promise<Response> {
  if (!RECIPE_ID.test(recipeId)) return notFound(`recipe ${recipeId} not found`);
  const repo = recipes(await getDb());
  if (!repo.getById(recipeId)) return notFound(`recipe ${recipeId} not found`);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("expected a multipart/form-data body");
  }
  const file = form.get(IMAGE_FIELD);
  if (!(file instanceof Blob)) return badRequest(`missing file field "${IMAGE_FIELD}"`);
  if (file.size === 0) return badRequest("empty file");
  if (file.size > MAX_IMAGE_BYTES) return badRequest(`file larger than ${MAX_IMAGE_BYTES} bytes`);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImage(bytes);
  if (!ext) return badRequest("not a png, jpeg, webp or gif image");

  const image = await storeImage(recipeId.toLowerCase(), ext, bytes);
  if (!repo.setImage(recipeId, image)) return notFound(`recipe ${recipeId} not found`);
  return Response.json({ image });
}

/**
 * GET /api/images/:file — the stored bytes with their content type. 400 when
 * the name is not one this server writes (so `..` and separators never reach
 * the filesystem), 404 when the file is absent.
 */
export async function handleGetImage(file: string): Promise<Response> {
  const contentType = imageContentType(file);
  if (!contentType) return badRequest("invalid image name");
  const blob = Bun.file(join(imagesDir(), file));
  if (!(await blob.exists())) return notFound(`image ${file} not found`);
  return new Response(blob, {
    headers: { "content-type": contentType, "content-length": String(blob.size), "cache-control": "private, max-age=0, must-revalidate" },
  });
}
