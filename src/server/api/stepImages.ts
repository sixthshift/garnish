import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import recipes from "../../db/models/recipe/repo";
import { IMAGE_FIELD, type ImageExtension, imageFileName, MAX_IMAGE_BYTES, sniffImage } from "../../lib/imageFile";
import { dataDir } from "../core/boot";
import { imagesDir, serveImage } from "./images";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `<root>/images/steps`; root defaults to the resolved DATA_DIR. */
export function stepImagesDir(root: string = dataDir()): string {
  return join(imagesDir(root), "steps");
}

/**
 * Write `bytes` as the step's photo, dropping any earlier file for that step
 * under a different extension. Returns the stored file name.
 */
export async function storeStepImage(stepId: string, ext: ImageExtension, bytes: Uint8Array, dir: string = stepImagesDir()): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const name = imageFileName(stepId, ext);
  await Bun.write(join(dir, name), bytes);
  for (const existing of readdirSync(dir)) {
    if (existing !== name && existing.toLowerCase().startsWith(`${stepId.toLowerCase()}.`)) unlinkSync(join(dir, existing));
  }
  return name;
}

const badRequest = (error: string): Response => Response.json({ error }, { status: 400 });
const notFound = (error: string): Response => Response.json({ error }, { status: 404 });

/**
 * POST /api/recipes/:id/steps/:stepId/image — multipart body with the file in
 * the `image` field. Stores it, points `step.image` at the file and answers
 * `{ image: "<stepId>.<ext>" }`. 404 for a step that has never been saved or is
 * not this recipe's, 400 for a missing, oversized or non-image file.
 */
export async function handleUploadStepImage(request: Request, recipeId: string, stepId: string): Promise<Response> {
  if (!UUID.test(recipeId) || !UUID.test(stepId)) return notFound(`step ${stepId} not found`);
  const record = recipes.ref(recipeId);
  if (!record.hasStep(stepId)) return notFound(`step ${stepId} not found`);

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

  const image = await storeStepImage(stepId.toLowerCase(), ext, bytes);
  if (!record.setStepImage(stepId, image)) return notFound(`step ${stepId} not found`);
  return Response.json({ image });
}

/** GET /api/images/steps/:file — a stored step image (`serveImage`). */
export function handleGetStepImage(file: string, request?: Request): Promise<Response> {
  return serveImage(stepImagesDir(), file, request);
}
