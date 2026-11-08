// Step photo routes (M35.1) against a temp DATA_DIR: upload then fetch returns
// the same bytes from images/steps/, replacement drops the old extension, a
// step that was never saved is refused, the photo survives a re-save of the
// recipe because the document carries it, and a step photo is not reachable
// through the recipe or timeline image routes. The upload's own checks (a bad
// file, a bad name) are one handler's for every kind: images.test.ts.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { recipeRepository } from "../../../../../src/db/models/recipe/repo";
import { type Recipe, recipeInputSchema } from "../../../../../src/domain/recipes/recipe";
import { getStepImageRoute as GetRoute, uploadStepImageRoute as PostRoute } from "../../../../../src/domain/recipes/routes/api/stepImages";
import { handleGetImage, handleUploadStepImage } from "../../../../../src/server/api/images";
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

/** A one-step recipe, and the id of that step. */
async function createRecipe(): Promise<Recipe> {
  const db = getDb();
  return recipeRepository(db).create(recipeInputSchema.parse({ name: "Flatbread", parts: [{ name: "", ingredients: [], steps: [{ text: "Knead it." }] }] }));
}

const stepIdOf = (recipe: Recipe) => recipe.parts[0]!.steps[0]!.id;

function upload(recipe: Recipe | string, stepId: string, body: BodyInit | null, field = "image", type = "image/png", name = "photo.png"): Promise<Response> {
  const recipeId = typeof recipe === "string" ? recipe : recipe.id;
  const form = new FormData();
  if (body !== null) form.set(field, new Blob([body as ArrayBuffer], { type }), name);
  return handleUploadStepImage(new Request(`http://localhost/api/recipes/${recipeId}/steps/${stepId}/image`, { method: "POST", body: form }), recipeId, stepId);
}

const bytesOf = async (res: Response) => new Uint8Array(await res.arrayBuffer());

test("a step's image folder sits under the data directory's images folder", () => {
  expect(imageDir("step", "/data")).toBe(join("/data", "images", "steps"));
});

test("upload then GET returns the same bytes, and the step points at the file", async () => {
  const recipe = await createRecipe();
  const stepId = stepIdOf(recipe);
  const posted = await upload(recipe, stepId, png);
  expect(posted.status).toBe(200);
  expect(await posted.json()).toEqual({ image: `${stepId}.png` });

  const got = await handleGetImage("step", `${stepId}.png`);
  expect(got.status).toBe(200);
  expect(got.headers.get("content-type")).toBe("image/png");
  expect(await bytesOf(got)).toEqual(png);

  expect(existsSync(join(tmp.dir, "images", "steps", `${stepId}.png`))).toBe(true);
  expect((await recipeRepository(getDb()).getById(recipe.id))?.parts[0]!.steps[0]!.image).toBe(`${stepId}.png`);
});

test("the photo survives a save, because the document carries it", async () => {
  const recipe = await createRecipe();
  const stepId = stepIdOf(recipe);
  await upload(recipe, stepId, png);

  const repo = recipeRepository(getDb());
  const stored = repo.getById(recipe.id)!;
  repo.ref(recipe.id).replace(recipeInputSchema.parse({ ...stored, name: "Flatbread, again" }));

  expect(repo.getById(recipe.id)?.parts[0]!.steps[0]!.image).toBe(`${stepId}.png`);
});

test("uploading a different format replaces the file and the stored name", async () => {
  const recipe = await createRecipe();
  const stepId = stepIdOf(recipe);
  await upload(recipe, stepId, png);
  const replaced = await upload(recipe, stepId, jpg, "image", "image/jpeg", "photo.jpg");
  expect(await replaced.json()).toEqual({ image: `${stepId}.jpg` });

  expect(readdirSync(join(tmp.dir, "images", "steps"))).toEqual([`${stepId}.jpg`]);
  expect((await handleGetImage("step", `${stepId}.png`)).status).toBe(404);
  expect(recipeRepository(getDb()).getById(recipe.id)?.parts[0]!.steps[0]!.image).toBe(`${stepId}.jpg`);
});

test("a step photo is not served as a recipe image or a timeline photo", async () => {
  const recipe = await createRecipe();
  const stepId = stepIdOf(recipe);
  await upload(recipe, stepId, png);
  expect((await handleGetImage("recipe", `${stepId}.png`)).status).toBe(404);
  expect((await handleGetImage("timeline", `${stepId}.png`)).status).toBe(404);
});

test("a step that was never saved, or is another recipe's, is 404 and nothing is written", async () => {
  const recipe = await createRecipe();
  const other = await createRecipe();
  expect((await upload(recipe, missing, png)).status).toBe(404);
  expect((await upload(recipe, "not-a-uuid", png)).status).toBe(404);
  expect((await upload(missing, stepIdOf(recipe), png)).status).toBe(404);
  expect((await upload(other, stepIdOf(recipe), png)).status).toBe(404);
  expect(existsSync(join(tmp.dir, "images", "steps"))).toBe(false);
});

test("routes wire POST and GET to the handlers with their path params", async () => {
  const recipe = await createRecipe();
  const stepId = stepIdOf(recipe);
  const post = handlersOf(PostRoute).POST!;
  const get = handlersOf(GetRoute).GET!;
  expect(handlersOf(PostRoute).GET).toBeUndefined();
  expect(handlersOf(GetRoute).POST).toBeUndefined();

  const form = new FormData();
  form.set("image", new Blob([png as unknown as ArrayBuffer], { type: "image/png" }), "photo.png");
  const posted = await post({
    request: new Request(`http://localhost/api/recipes/${recipe.id}/steps/${stepId}/image`, { method: "POST", body: form }),
    params: { id: recipe.id, stepId },
  });
  expect(await posted.json()).toEqual({ image: `${stepId}.png` });

  const got = await get({ request: new Request(`http://localhost/api/images/steps/${stepId}.png`), params: { file: `${stepId}.png` } });
  expect(await bytesOf(got)).toEqual(png);
});
