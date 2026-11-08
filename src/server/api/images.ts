import { join } from "node:path";
import type { ImageKind } from "../../app/features/settings/model/backup";
import recipes from "../../db/models/recipe/repo";
import timeline from "../../db/models/timeline/repo";
import { IMAGE_FIELD, type ImageExtension, imageContentType, MAX_IMAGE_BYTES, sniffImage } from "../../lib/imageFile";
import { imageDir, storeImage } from "../core/images";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const badRequest = (error: string): Response => Response.json({ error }, { status: 400 });
const notFound = (error: string): Response => Response.json({ error }, { status: 404 });

/** The image in a multipart body's `image` field, or the 400 saying why there is none. */
async function readImageUpload(request: Request): Promise<{ bytes: Uint8Array; ext: ImageExtension } | Response> {
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
  return ext ? { bytes, ext } : badRequest("not a png, jpeg, webp or gif image");
}

type Owner = {
  /** What a 404 names: "recipe <id>". */
  what: string;
  /** Whether the owner exists, checked before the body is read. */
  exists: () => boolean;
  /** Point the owner at the stored file; false when it has gone meanwhile. */
  setImage: (file: string) => boolean;
};

/**
 * One upload: store the file as `id`'s `kind` image, point its owner at it and
 * answer `{ image: "<id>.<ext>" }`, Mealie's shape. 404 for an unknown owner,
 * 400 for a missing, oversized or non-image file.
 */
async function upload(request: Request, kind: ImageKind, id: string, owner: Owner): Promise<Response> {
  if (!UUID.test(id) || !owner.exists()) return notFound(`${owner.what} not found`);
  const file = await readImageUpload(request);
  if (file instanceof Response) return file;
  const image = await storeImage(imageDir(kind), id.toLowerCase(), file.ext, file.bytes);
  return owner.setImage(image) ? Response.json({ image }) : notFound(`${owner.what} not found`);
}

/** POST /api/recipes/:id/image — the recipe's photo. */
export function handleUploadImage(request: Request, recipeId: string): Promise<Response> {
  return upload(request, "recipe", recipeId, {
    what: `recipe ${recipeId}`,
    exists: () => Boolean(recipes.getById(recipeId)),
    setImage: (image) => recipes.ref(recipeId).setImage(image),
  });
}

/** POST /api/recipes/:id/steps/:stepId/image — a step's photo; 404 for a step never saved or not this recipe's. */
export function handleUploadStepImage(request: Request, recipeId: string, stepId: string): Promise<Response> {
  return upload(request, "step", stepId, {
    what: `step ${stepId}`,
    exists: () => UUID.test(recipeId) && recipes.ref(recipeId).hasStep(stepId),
    setImage: (image) => recipes.ref(recipeId).setStepImage(stepId, image),
  });
}

/** POST /api/timeline/:id/image — a cook-log entry's photo. */
export function handleUploadTimelineImage(request: Request, eventId: string): Promise<Response> {
  return upload(request, "timeline", eventId, {
    what: `timeline event ${eventId}`,
    exists: () => Boolean(timeline.get(eventId)),
    setImage: (image) => timeline.setImage(eventId, image),
  });
}

/**
 * GET /api/images/[steps/|timeline/]:file — a stored `kind` image. 400 when
 * the name is not one this server writes (so `..` and separators never reach
 * the filesystem), 404 when the file is absent. A replaced image keeps its
 * URL, so the browser revalidates every time; the ETag (size and modified
 * time) lets an unchanged image answer 304 with no body.
 */
export async function handleGetImage(kind: ImageKind, file: string, request?: Request): Promise<Response> {
  const contentType = imageContentType(file);
  if (!contentType) return badRequest("invalid image name");
  const blob = Bun.file(join(imageDir(kind), file));
  if (!(await blob.exists())) return notFound(`image ${file} not found`);
  const etag = `W/"${blob.size.toString(36)}-${Math.trunc(blob.lastModified).toString(36)}"`;
  const headers = { etag, "cache-control": "private, max-age=0, must-revalidate" };
  if (request?.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(blob, { headers: { ...headers, "content-type": contentType, "content-length": String(blob.size) } });
}
