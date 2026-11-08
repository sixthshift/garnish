// Timeline photo routes against a temp DATA_DIR: upload then fetch returns the
// same bytes from images/timeline/, replacement drops the old extension, an
// unknown event is refused, and a recipe image is not reachable through the
// timeline route (nor the other way round). The upload's own checks (a bad
// file, a bad name) are one handler's for every kind: images.test.ts.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { recipeRepository } from "../../../../../src/db/models/recipe/repo";
import { timelineRepository } from "../../../../../src/db/models/timeline/repo";
import { recipeInputSchema, type TimelineEvent } from "../../../../../src/domain/recipes/recipe";
import { getTimelineImageRoute as GetRoute, uploadTimelineImageRoute as PostRoute } from "../../../../../src/domain/recipes/routes/api/timelineImages";
import { handleGetImage, handleUploadTimelineImage } from "../../../../../src/server/api/images";
import { getDb } from "../../../../../src/server/core/db";
import { imageDir } from "../../../../../src/server/core/images";
import { handlersOf } from "../../../../helpers/routes";
import { useTempDataDir } from "../../../../helpers/server";
import { PNG_BYTES } from "../../../../helpers/zip";

const tmp = useTempDataDir();

const missing = "99999999-9999-4999-8999-999999999999";
// A real 1x1 PNG, so the bytes are what a browser would send.
const png = PNG_BYTES;
const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9]);

async function createEvent(): Promise<TimelineEvent> {
  const db = getDb();
  const recipe = recipeRepository(db).create(recipeInputSchema.parse({ name: "Flatbread", parts: [{ name: "", ingredients: [], steps: [] }] }));
  return timelineRepository(db).create(recipe.id, { occurredOn: "2026-09-11", message: "", image: null, servings: null });
}

function upload(id: string, body: BodyInit | null, field = "image", type = "image/png", name = "photo.png"): Promise<Response> {
  const form = new FormData();
  if (body !== null) form.set(field, new Blob([body as ArrayBuffer], { type }), name);
  return handleUploadTimelineImage(new Request(`http://localhost/api/timeline/${id}/image`, { method: "POST", body: form }), id);
}

const bytesOf = async (res: Response) => new Uint8Array(await res.arrayBuffer());

test("a timeline image folder sits under the data directory's images folder", () => {
  expect(imageDir("timeline", "/data")).toBe(join("/data", "images", "timeline"));
});

test("upload then GET returns the same bytes, and the event points at the file", async () => {
  const event = await createEvent();
  const posted = await upload(event.id, png);
  expect(posted.status).toBe(200);
  expect(await posted.json()).toEqual({ image: `${event.id}.png` });

  const got = await handleGetImage("timeline", `${event.id}.png`);
  expect(got.status).toBe(200);
  expect(got.headers.get("content-type")).toBe("image/png");
  expect(await bytesOf(got)).toEqual(png);

  expect(existsSync(join(tmp.dir, "images", "timeline", `${event.id}.png`))).toBe(true);
  expect(timelineRepository(getDb()).get(event.id)?.image).toBe(`${event.id}.png`);
});

test("uploading a different format replaces the file and the stored name", async () => {
  const event = await createEvent();
  await upload(event.id, png);
  const replaced = await upload(event.id, jpg, "image", "image/jpeg", "photo.jpg");
  expect(await replaced.json()).toEqual({ image: `${event.id}.jpg` });

  expect(readdirSync(join(tmp.dir, "images", "timeline"))).toEqual([`${event.id}.jpg`]);
  expect((await handleGetImage("timeline", `${event.id}.png`)).status).toBe(404);
  expect(timelineRepository(getDb()).get(event.id)?.image).toBe(`${event.id}.jpg`);
});

test("a timeline photo is not served as a recipe image", async () => {
  const event = await createEvent();
  await upload(event.id, png);
  expect((await handleGetImage("recipe", `${event.id}.png`)).status).toBe(404);
});

test("unknown event is 404 and nothing is written", async () => {
  expect((await upload(missing, png)).status).toBe(404);
  expect((await upload("not-a-uuid", png)).status).toBe(404);
  expect(existsSync(join(tmp.dir, "images", "timeline"))).toBe(false);
});

test("routes wire POST and GET to the handlers with their path params", async () => {
  const event = await createEvent();
  const post = handlersOf(PostRoute).POST!;
  const get = handlersOf(GetRoute).GET!;
  expect(handlersOf(PostRoute).GET).toBeUndefined();
  expect(handlersOf(GetRoute).POST).toBeUndefined();

  const form = new FormData();
  form.set("image", new Blob([png as unknown as ArrayBuffer], { type: "image/png" }), "photo.png");
  const posted = await post({
    request: new Request(`http://localhost/api/timeline/${event.id}/image`, { method: "POST", body: form }),
    params: { id: event.id },
  });
  expect(await posted.json()).toEqual({ image: `${event.id}.png` });

  const got = await get({ request: new Request(`http://localhost/api/images/timeline/${event.id}.png`), params: { file: `${event.id}.png` } });
  expect(await bytesOf(got)).toEqual(png);
});
