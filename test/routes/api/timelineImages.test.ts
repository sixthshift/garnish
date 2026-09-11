// Timeline photo routes against a temp DATA_DIR: upload then fetch returns the
// same bytes from images/timeline/, replacement drops the old extension,
// unknown event and bad input, and a recipe image is not reachable through the
// timeline route (nor the other way round).
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { recipes } from "../../../src/db/recipes";
import { timeline } from "../../../src/db/timeline";
import { recipeInputSchema, type TimelineEvent } from "../../../src/domain/recipe";
import { getDb } from "../../../src/server/db";
import { handleGetImage } from "../../../src/server/images";
import { handleGetTimelineImage, handleUploadTimelineImage, timelineImagesDir } from "../../../src/server/timelineImages";
import { Route as GetRoute } from "../../../src/routes/api/images/timeline/$file";
import { Route as PostRoute } from "../../../src/routes/api/timeline/$id/image";
import { useTempDataDir } from "../../helpers/server";

const tmp = useTempDataDir();

type Handler = (ctx: { request: Request; params: Record<string, string> }) => Response | Promise<Response>;
const handlersOf = (route: { options: { server?: unknown } }) => (route.options.server as { handlers?: Record<string, Handler> } | undefined)?.handlers ?? {};

const missing = "99999999-9999-4999-8999-999999999999";
// A real 1x1 PNG, so the bytes are what a browser would send.
const png = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"),
);
const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9]);

async function createEvent(): Promise<TimelineEvent> {
  const db = await getDb();
  const recipe = recipes(db).create(recipeInputSchema.parse({ name: "Flatbread", components: [{ name: "", ingredients: [], steps: [] }] }));
  return timeline(db).create(recipe.id, { occurredOn: "2026-09-11", message: "", image: null });
}

function upload(id: string, body: BodyInit | null, field = "image", type = "image/png", name = "photo.png"): Promise<Response> {
  const form = new FormData();
  if (body !== null) form.set(field, new Blob([body as ArrayBuffer], { type }), name);
  return handleUploadTimelineImage(new Request(`http://localhost/api/timeline/${id}/image`, { method: "POST", body: form }), id);
}

const bytesOf = async (res: Response) => new Uint8Array(await res.arrayBuffer());

test("timelineImagesDir sits under the data directory's images folder", () => {
  expect(timelineImagesDir("/data")).toBe(join("/data", "images", "timeline"));
});

test("upload then GET returns the same bytes, and the event points at the file", async () => {
  const event = await createEvent();
  const posted = await upload(event.id, png);
  expect(posted.status).toBe(200);
  expect(await posted.json()).toEqual({ image: `${event.id}.png` });

  const got = await handleGetTimelineImage(`${event.id}.png`);
  expect(got.status).toBe(200);
  expect(got.headers.get("content-type")).toBe("image/png");
  expect(await bytesOf(got)).toEqual(png);

  expect(existsSync(join(tmp.dir, "images", "timeline", `${event.id}.png`))).toBe(true);
  expect(timeline(await getDb()).get(event.id)?.image).toBe(`${event.id}.png`);
});

test("uploading a different format replaces the file and the stored name", async () => {
  const event = await createEvent();
  await upload(event.id, png);
  const replaced = await upload(event.id, jpg, "image", "image/jpeg", "photo.jpg");
  expect(await replaced.json()).toEqual({ image: `${event.id}.jpg` });

  expect(readdirSync(join(tmp.dir, "images", "timeline"))).toEqual([`${event.id}.jpg`]);
  expect((await handleGetTimelineImage(`${event.id}.png`)).status).toBe(404);
  expect(timeline(await getDb()).get(event.id)?.image).toBe(`${event.id}.jpg`);
});

test("the format comes from the bytes, not the declared type or file name", async () => {
  const event = await createEvent();
  expect(await (await upload(event.id, jpg, "image", "image/png", "photo.png")).json()).toEqual({ image: `${event.id}.jpg` });
});

test("a timeline photo is not served as a recipe image", async () => {
  const event = await createEvent();
  await upload(event.id, png);
  expect((await handleGetImage(`${event.id}.png`)).status).toBe(404);
});

test("unknown event is 404 and nothing is written", async () => {
  expect((await upload(missing, png)).status).toBe(404);
  expect((await upload("not-a-uuid", png)).status).toBe(404);
  expect(existsSync(join(tmp.dir, "images", "timeline"))).toBe(false);
});

test.each([
  ["no file field", (id: string) => upload(id, null)],
  ["wrong field name", (id: string) => upload(id, png, "photo")],
  ["empty file", (id: string) => upload(id, new Uint8Array())],
  ["not an image", (id: string) => upload(id, new TextEncoder().encode("<svg/>"), "image", "image/svg+xml", "x.svg")],
  [
    "json body",
    (id: string) =>
      handleUploadTimelineImage(
        new Request(`http://localhost/api/timeline/${id}/image`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
        id,
      ),
  ],
])("bad upload is 400: %s", async (_label, send) => {
  const event = await createEvent();
  const res = await send(event.id);
  expect(res.status).toBe(400);
  expect(typeof (await res.json()).error).toBe("string");
  expect(timeline(await getDb()).get(event.id)?.image).toBeNull();
});

test.each(["../garnish.db", "..", "images/x.png", "x/y.png", "garnish.db", `${missing}.svg`, ""])("GET rejects a name that is not <uuid>.<ext>: %j", async (file) => {
  expect((await handleGetTimelineImage(file)).status).toBe(400);
});

test("GET of a well-formed but absent photo is 404", async () => {
  expect((await handleGetTimelineImage(`${missing}.png`)).status).toBe(404);
});

test("routes wire POST and GET to the handlers with their path params", async () => {
  const event = await createEvent();
  const post = handlersOf(PostRoute).POST!;
  const get = handlersOf(GetRoute).GET!;
  expect(handlersOf(PostRoute).GET).toBeUndefined();
  expect(handlersOf(GetRoute).POST).toBeUndefined();

  const form = new FormData();
  form.set("image", new Blob([png as unknown as ArrayBuffer], { type: "image/png" }), "photo.png");
  const posted = await post({ request: new Request(`http://localhost/api/timeline/${event.id}/image`, { method: "POST", body: form }), params: { id: event.id } });
  expect(await posted.json()).toEqual({ image: `${event.id}.png` });

  const got = await get({ request: new Request(`http://localhost/api/images/timeline/${event.id}.png`), params: { file: `${event.id}.png` } });
  expect(await bytesOf(got)).toEqual(png);
});
