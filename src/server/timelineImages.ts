// Server-only. Photos attached to a logged cook: one file per event under
// `<DATA_DIR>/images/timeline/<eventId>.<ext>`, the file name mastered in
// `timeline_event.image`. The format sniffing, size cap and name checks are
// the recipe image store's (./images.ts); only the directory differs, so a
// timeline photo can never be served as, or overwrite, a recipe image.
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { timeline } from "../db/models/timeline/repo";
import { dataDir } from "./boot";
import { getDb } from "./db";
import { IMAGE_FIELD, MAX_IMAGE_BYTES, imageContentType, imageFileName, sniffImage, type ImageExtension } from "../domain/image";
import { imagesDir } from "./images";

const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `<root>/images/timeline`; root defaults to the resolved DATA_DIR. */
export function timelineImagesDir(root: string = dataDir()): string {
  return join(imagesDir(root), "timeline");
}

/**
 * Write `bytes` as the event's photo, dropping any earlier file for that event
 * under a different extension. Returns the stored file name.
 */
export async function storeTimelineImage(eventId: string, ext: ImageExtension, bytes: Uint8Array, dir: string = timelineImagesDir()): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const name = imageFileName(eventId, ext);
  await Bun.write(join(dir, name), bytes);
  for (const existing of readdirSync(dir)) {
    if (existing !== name && existing.toLowerCase().startsWith(`${eventId.toLowerCase()}.`)) unlinkSync(join(dir, existing));
  }
  return name;
}

const badRequest = (error: string): Response => Response.json({ error }, { status: 400 });
const notFound = (error: string): Response => Response.json({ error }, { status: 404 });

/**
 * POST /api/timeline/:id/image — multipart body with the file in the `image`
 * field. Stores it, points `timeline_event.image` at the file and answers
 * `{ image: "<id>.<ext>" }`. 404 for an unknown event, 400 for a missing,
 * oversized or non-image file.
 */
export async function handleUploadTimelineImage(request: Request, eventId: string): Promise<Response> {
  if (!EVENT_ID.test(eventId)) return notFound(`timeline event ${eventId} not found`);
  const repo = timeline(await getDb());
  if (!repo.get(eventId)) return notFound(`timeline event ${eventId} not found`);

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

  const image = await storeTimelineImage(eventId.toLowerCase(), ext, bytes);
  if (!repo.setImage(eventId, image)) return notFound(`timeline event ${eventId} not found`);
  return Response.json({ image });
}

/**
 * GET /api/images/timeline/:file — the stored bytes with their content type.
 * 400 when the name is not one this server writes (so `..` and separators
 * never reach the filesystem), 404 when the file is absent.
 */
export async function handleGetTimelineImage(file: string): Promise<Response> {
  const contentType = imageContentType(file);
  if (!contentType) return badRequest("invalid image name");
  const blob = Bun.file(join(timelineImagesDir(), file));
  if (!(await blob.exists())) return notFound(`image ${file} not found`);
  return new Response(blob, {
    headers: { "content-type": contentType, "content-length": String(blob.size), "cache-control": "private, max-age=0, must-revalidate" },
  });
}
