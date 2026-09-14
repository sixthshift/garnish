// POST /api/import/file (M34.3, M34.4): the upload route the source chooser
// posts a Mealie or Tandoor export to. Nothing is written — the route parses
// and answers — so there is no database here, only the route.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { MealieRecipe } from "../../../src/domain/import/sources/importMealie";
import type { ExportRecipe } from "../../../src/domain/import/sources/importTandoor";
import { Route } from "../../../src/routes/api/import/file";
import { handleImportFile, IMPORT_FIELD } from "../../../src/server/api/importFile";
import { makeZip, PNG_BYTES } from "../../helpers/zip";

const FIXTURE = join(import.meta.dirname, "../../fixtures/mealie/lemon-tart.json");
const fixtureText = (): string => readFileSync(FIXTURE, "utf8");
const TANDOOR = join(import.meta.dirname, "../../fixtures/tandoor/lemon-tart.json");
const tandoorText = (): string => readFileSync(TANDOOR, "utf8");

type Handler = (ctx: { request: Request; params: Record<string, string> }) => Response | Promise<Response>;
const handlersOf = (route: { options: { server?: unknown } }) =>
  (route.options.server as { handlers?: Record<string, Handler> } | undefined)?.handlers ?? {};

function upload(body: BodyInit | null, name = "lemon-tart.json", type = "application/json"): Request {
  const form = new FormData();
  if (body !== null) form.append(IMPORT_FIELD, new File([body as BlobPart], name, { type }));
  return new Request("http://localhost/api/import/file", { method: "POST", body: form });
}

test("a single recipe JSON comes back as one recipe", async () => {
  const response = await handleImportFile(upload(fixtureText()));
  expect(response.status).toBe(200);
  const payload = (await response.json()) as { recipes: MealieRecipe[] };
  expect(payload.recipes).toHaveLength(1);
  expect(payload.recipes[0]!.name).toBe("Lemon tart");
  expect(payload.recipes[0]!.parts.map((part) => part.name)).toEqual(["Pastry", "Filling", "To finish"]);
});

test("a backup zip comes back with every recipe and its image", async () => {
  const recipe = JSON.parse(fixtureText()) as { id: string; name: string };
  const zip = await makeZip([
    { name: "database.json", bytes: new TextEncoder().encode(JSON.stringify({ recipes: [recipe, { ...recipe, id: "other", name: "Pancakes" }] })), deflate: true },
    { name: `data/recipes/${recipe.id}/images/original.png`, bytes: PNG_BYTES },
  ]);
  const response = await handleImportFile(upload(zip as BlobPart as BodyInit, "backup.zip", "application/zip"));
  const payload = (await response.json()) as { recipes: MealieRecipe[] };
  expect(payload.recipes.map((r) => r.name)).toEqual(["Lemon tart", "Pancakes"]);
  expect(payload.recipes[0]!.image).toMatch(/^data:image\/png;base64,/);
  expect(payload.recipes[1]!.image).toBeNull();
});

test("the route is wired to the handler", async () => {
  const post = handlersOf(Route)["POST"];
  expect(post).toBeTypeOf("function");
  const response = await post!({ request: upload(fixtureText()), params: {} });
  expect(response.status).toBe(200);
});

test("a Tandoor recipe.json comes back parsed, its steps as parts (M34.4)", async () => {
  const response = await handleImportFile(upload(tandoorText(), "recipe.json"));
  expect(response.status).toBe(200);
  const payload = (await response.json()) as { recipes: ExportRecipe[] };
  expect(payload.recipes).toHaveLength(1);
  const recipe = payload.recipes[0]!;
  expect(recipe.source).toBe("tandoor");
  expect(recipe.name).toBe("Lemon tart");
  expect(recipe.parts.map((part) => part.name)).toEqual(["Pastry", "Filling", ""]);
});

test("a missing, empty or unreadable file is a 400 with a message", async () => {
  const missing = await handleImportFile(upload(null));
  expect(missing.status).toBe(400);
  expect((await missing.json()) as { error: string }).toEqual({ error: `missing file field "${IMPORT_FIELD}"` });

  const empty = await handleImportFile(upload(""));
  expect(empty.status).toBe(400);
  expect(((await empty.json()) as { error: string }).error).toBe("That file is empty");

  const rubbish = await handleImportFile(upload("hello", "notes.txt", "text/plain"));
  expect(rubbish.status).toBe(400);
  expect(((await rubbish.json()) as { error: string }).error).toBe("That file is not JSON or a zip");

  const notForm = new Request("http://localhost/api/import/file", { method: "POST", body: "x", headers: { "Content-Type": "text/plain" } });
  const bad = await handleImportFile(notForm);
  expect(bad.status).toBe(400);
  expect(((await bad.json()) as { error: string }).error).toBe("expected a multipart/form-data body");
});
