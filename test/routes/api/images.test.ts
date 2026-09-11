// Image routes against a temp DATA_DIR: upload then fetch returns the same
// bytes, replacement drops the old extension, unknown recipe and bad input.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { recipes } from "../../../src/db/models/recipe/repo";
import { recipeInputSchema } from "../../../src/domain/recipe";
import { getDb } from "../../../src/server/db";
import { handleGetImage, handleUploadImage } from "../../../src/server/images";
import { Route as GetRoute } from "../../../src/routes/api/images/$file";
import { Route as PostRoute } from "../../../src/routes/api/recipes/$id/image";
import { useTempDataDir } from "../../helpers/server";

const tmp = useTempDataDir();

type Handler = (ctx: { request: Request; params: Record<string, string> }) => Response | Promise<Response>;
const handlersOf = (route: { options: { server?: unknown } }) =>
  (route.options.server as { handlers?: Record<string, Handler> } | undefined)?.handlers ?? {};

const missing = "99999999-9999-4999-8999-999999999999";
// A real 1x1 PNG, so the bytes are what a browser would send.
const png = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"),
);
const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9]);

async function createRecipe(name = "Flatbread"): Promise<string> {
  const repo = recipes(await getDb());
  return repo.create(recipeInputSchema.parse({ name, components: [{ name: "", ingredients: [], steps: [] }] })).id;
}

function upload(id: string, body: BodyInit | null, field = "image", type = "image/png", name = "photo.png"): Promise<Response> {
  const form = new FormData();
  if (body !== null) form.set(field, new Blob([body as ArrayBuffer], { type }), name);
  return handleUploadImage(new Request(`http://localhost/api/recipes/${id}/image`, { method: "POST", body: form }), id);
}

const bytesOf = async (res: Response) => new Uint8Array(await res.arrayBuffer());

test("upload then GET returns the same bytes with the image content type", async () => {
  const id = await createRecipe();
  const posted = await upload(id, png);
  expect(posted.status).toBe(200);
  expect(await posted.json()).toEqual({ image: `${id}.png` });

  const got = await handleGetImage(`${id}.png`);
  expect(got.status).toBe(200);
  expect(got.headers.get("content-type")).toBe("image/png");
  expect(got.headers.get("content-length")).toBe(String(png.length));
  expect(await bytesOf(got)).toEqual(png);

  expect(existsSync(join(tmp.dir, "images", `${id}.png`))).toBe(true);
  expect(recipes(await getDb()).getById(id)?.image).toBe(`${id}.png`);
});

test("uploading a different format replaces the file and updates recipe.image", async () => {
  const id = await createRecipe();
  await upload(id, png);
  const replaced = await upload(id, jpg, "image", "image/jpeg", "photo.jpg");
  expect(await replaced.json()).toEqual({ image: `${id}.jpg` });

  expect(readdirSync(join(tmp.dir, "images"))).toEqual([`${id}.jpg`]);
  expect((await handleGetImage(`${id}.png`)).status).toBe(404);
  const got = await handleGetImage(`${id}.jpg`);
  expect(got.headers.get("content-type")).toBe("image/jpeg");
  expect(await bytesOf(got)).toEqual(jpg);
  expect(recipes(await getDb()).getById(id)?.image).toBe(`${id}.jpg`);
});

test("the format comes from the bytes, not the declared type or file name", async () => {
  const id = await createRecipe();
  const res = await upload(id, jpg, "image", "image/png", "photo.png");
  expect(await res.json()).toEqual({ image: `${id}.jpg` });
});

test("unknown recipe is 404 and nothing is written", async () => {
  const res = await upload(missing, png);
  expect(res.status).toBe(404);
  expect(existsSync(join(tmp.dir, "images"))).toBe(false);
  expect((await upload("not-a-uuid", png)).status).toBe(404);
});

test.each([
  ["no file field", (id: string) => upload(id, null)],
  ["wrong field name", (id: string) => upload(id, png, "photo")],
  ["empty file", (id: string) => upload(id, new Uint8Array())],
  ["not an image", (id: string) => upload(id, new TextEncoder().encode("<svg/>"), "image", "image/svg+xml", "x.svg")],
  [
    "string field instead of a file",
    (id: string) => {
      const form = new FormData();
      form.set("image", "base64-would-go-here");
      return handleUploadImage(new Request(`http://localhost/api/recipes/${id}/image`, { method: "POST", body: form }), id);
    },
  ],
  [
    "json body",
    (id: string) =>
      handleUploadImage(
        new Request(`http://localhost/api/recipes/${id}/image`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
        id,
      ),
  ],
])("bad upload is 400: %s", async (_label, send) => {
  const id = await createRecipe();
  const res = await send(id);
  expect(res.status).toBe(400);
  expect(typeof (await res.json()).error).toBe("string");
  expect(recipes(await getDb()).getById(id)?.image).toBeNull();
});

test.each(["../garnish.db", "..", "images/x.png", "x/y.png", "garnish.db", `${missing}.svg`, ""])(
  "GET rejects a name that is not <uuid>.<ext>: %j",
  async (file) => {
    const res = await handleGetImage(file);
    expect(res.status).toBe(400);
  },
);

test("GET of a well-formed but absent image is 404", async () => {
  expect((await handleGetImage(`${missing}.png`)).status).toBe(404);
});

test("routes wire POST and GET to the handlers with their path params", async () => {
  const id = await createRecipe();
  const post = handlersOf(PostRoute).POST!;
  const get = handlersOf(GetRoute).GET!;
  expect(typeof post).toBe("function");
  expect(typeof get).toBe("function");
  expect(handlersOf(PostRoute).GET).toBeUndefined();
  expect(handlersOf(GetRoute).POST).toBeUndefined();

  const form = new FormData();
  form.set("image", new Blob([png as unknown as ArrayBuffer], { type: "image/png" }), "photo.png");
  const posted = await post({ request: new Request(`http://localhost/api/recipes/${id}/image`, { method: "POST", body: form }), params: { id } });
  expect(await posted.json()).toEqual({ image: `${id}.png` });

  const got = await get({ request: new Request(`http://localhost/api/images/${id}.png`), params: { file: `${id}.png` } });
  expect(await bytesOf(got)).toEqual(png);
});
