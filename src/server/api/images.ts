import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { recipes } from "../../db/models/recipe/repo";
import { IMAGE_FIELD, IMAGE_TYPES, type ImageExtension, imageContentType, imageFileName, MAX_IMAGE_BYTES, sniffImage } from "../../lib/imageFile";
import { dataDir } from "../core/boot";
import { getDb } from "../core/db";

export { IMAGE_FIELD, IMAGE_TYPES, type ImageExtension, imageContentType, imageFileName, MAX_IMAGE_BYTES, sniffImage } from "../../lib/imageFile";

const RECIPE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `<root>/images`; root defaults to the resolved DATA_DIR. */
export function imagesDir(root: string = dataDir()): string {
  return join(root, "images");
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
