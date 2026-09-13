// Server-only. Photos attached to a method step (M35.1): one file per step
// under `<DATA_DIR>/images/steps/<stepId>.<ext>`, the file name mastered in
// `step.image` and carried in the recipe document so a save keeps it.
//
// The pure rules — formats, size cap, sniffing, file naming — are the recipe
// image store's (./images.ts, src/domain/image.ts); only the directory
// differs, so a step photo can never be served as, or overwrite, a recipe
// image or a timeline photo.
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { recipes } from "../db/models/recipe/repo";
import { IMAGE_FIELD, MAX_IMAGE_BYTES, imageContentType, imageFileName, sniffImage, type ImageExtension } from "../domain/image";
import { dataDir } from "./boot";
import { getDb } from "./db";
import { imagesDir } from "./images";

const STEP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * POST /api/steps/:id/image — multipart body with the file in the `image`
 * field. Stores it, points `step.image` at the file and answers
 * `{ image: "<id>.<ext>" }`. 404 for a step that has never been saved, 400 for
 * a missing, oversized or non-image file.
 */
export async function handleUploadStepImage(request: Request, stepId: string): Promise<Response> {
  if (!STEP_ID.test(stepId)) return notFound(`step ${stepId} not found`);
  const repo = recipes(await getDb());
  if (!repo.stepExists(stepId)) return notFound(`step ${stepId} not found`);

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
  if (!repo.setStepImage(stepId, image)) return notFound(`step ${stepId} not found`);
  return Response.json({ image });
}

/**
 * GET /api/images/steps/:file — the stored bytes with their content type. 400
 * when the name is not one this server writes (so `..` and separators never
 * reach the filesystem), 404 when the file is absent.
 */
export async function handleGetStepImage(file: string): Promise<Response> {
  const contentType = imageContentType(file);
  if (!contentType) return badRequest("invalid image name");
  const blob = Bun.file(join(stepImagesDir(), file));
  if (!(await blob.exists())) return notFound(`image ${file} not found`);
  return new Response(blob, {
    headers: { "content-type": contentType, "content-length": String(blob.size), "cache-control": "private, max-age=0, must-revalidate" },
  });
}
