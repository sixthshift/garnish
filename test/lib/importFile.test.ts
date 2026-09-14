// Posting a Mealie export to the parse route, and rebuilding an image that
// came back from it as a data URL (M34.3). The fetch is injected, so neither
// needs a server.
import { expect, test } from "vitest";
import { type MealieRecipe } from "../../src/domain/import";
import { IMPORT_FIELD, IMPORT_FILE_URL, postImportFile } from "../../src/lib/importFile";
import { dataUrlFile } from "../../src/lib/images";
import { PNG_BYTES } from "../helpers/zip";

const file = (): File => new File(["{}"], "backup.zip", { type: "application/zip" });

test("the file is posted as multipart to the import route, and the recipes come back", async () => {
  const seen: { url: string; field: unknown } = { url: "", field: null };
  const recipes = [{ name: "Lemon tart" }] as MealieRecipe[];
  const found = await postImportFile(file(), async (url, init) => {
    seen.url = url;
    seen.field = (init?.body as FormData).get(IMPORT_FIELD);
    return Response.json({ recipes });
  });
  expect(seen.url).toBe(IMPORT_FILE_URL);
  expect(seen.field).toBeInstanceOf(File);
  expect((seen.field as File).name).toBe("backup.zip");
  expect(found).toEqual(recipes);
});

test("the route's message is what the screen is told", async () => {
  await expect(postImportFile(file(), async () => Response.json({ error: "That file is not JSON or a zip" }, { status: 400 }))).rejects.toThrow(
    "That file is not JSON or a zip",
  );
  await expect(postImportFile(file(), async () => new Response("nope", { status: 500 }))).rejects.toThrow("(500)");
});

test("an answer with no recipes is no recipes, not a crash", async () => {
  expect(await postImportFile(file(), async () => Response.json({}))).toEqual([]);
});

test("dataUrlFile rebuilds an image the parser read out of a zip", () => {
  const url = `data:image/png;base64,${Buffer.from(PNG_BYTES).toString("base64")}`;
  const rebuilt = dataUrlFile(url, "lemon-tart");
  expect(rebuilt.name).toBe("lemon-tart.png");
  expect(rebuilt.type).toBe("image/png");
  expect(rebuilt.size).toBe(PNG_BYTES.length);
  expect(() => dataUrlFile("https://example.test/a.png")).toThrow("not a base64 data URL");
});
