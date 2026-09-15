// The two export routes (M34.1) against a temp DATA_DIR: one recipe's document
// and the whole-database file, over a fixture that exercises the parts of the
// document an export is most likely to lose — a step linked to its ingredient
// rows, an ingredient whose food is made by another recipe, a food conversion,
// an aisle, a tag, and an image.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { aisles } from "../../../src/db/models/aisle/repo";
import { foods } from "../../../src/db/models/food/repo";
import { recipes } from "../../../src/db/models/recipe/repo";
import { tags } from "../../../src/db/models/tag/repo";
import { units } from "../../../src/db/models/unit/repo";
import { type Recipe, recipeInputSchema } from "../../../src/domain/recipe";
import { exportJsonRoute as ExportRoute, recipeCookRoute as RecipeCookRoute, recipeJsonRoute as RecipeJsonRoute } from "../../../src/routes/api/export";
import { buildExport, type GarnishExport, handleExportJson, handleRecipeCook, handleRecipeJson } from "../../../src/server/api/export";
import { getDb } from "../../../src/server/core/db";
import { testRouter } from "../../helpers/routes";
import { useTempDataDir } from "../../helpers/server";

useTempDataDir();

type Handler = (ctx: { request: Request; params: Record<string, string> }) => Response | Promise<Response>;
const handlersOf = (route: { options: { server?: unknown } }) => (route.options.server as { handlers?: Record<string, Handler> } | undefined)?.handlers ?? {};

const PASTRY_INGREDIENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const FLOUR_INGREDIENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";

/**
 * A tart whose first ingredient is a food made by the pastry recipe and whose
 * step links both of its rows, plus a flour with a cup-to-gram conversion in
 * the Baking aisle.
 */
async function seed(): Promise<{ tart: Recipe; pastry: Recipe }> {
  const db = await getDb();
  const recipeRepo = recipes(db);
  const unitRepo = units(db);
  const foodRepo = foods(db);

  // The seed has already created the common units, so take them as they are.
  const gram = unitRepo.getByName("gram") ?? unitRepo.create({ name: "gram", abbreviation: "g" });
  const cup = unitRepo.getByName("cup") ?? unitRepo.create({ name: "cup" });
  const baking = aisles(db).create({ name: "Baking" });
  const dessert = tags(db).create({ name: "Dessert" });

  const pastry = recipeRepo.create(
    recipeInputSchema.parse({
      name: "Sweet pastry",
      recipeServings: 4,
      recipeYieldQuantity: 500,
      yieldUnit: gram,
      parts: [{ name: "", steps: [{ text: "Rub it together." }] }],
    })
  );
  const pastryFood = foodRepo.create({ name: "Sweet pastry", recipeId: pastry.id });
  const flour = foodRepo.create({
    name: "Plain flour",
    aisleId: baking.id,
    conversions: [{ unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 125 }],
  });

  const tart = recipeRepo.create(
    recipeInputSchema.parse({
      name: "Lemon tart",
      recipeServings: 8,
      tags: [dessert],
      parts: [
        {
          name: "",
          ingredients: [
            { id: PASTRY_INGREDIENT, quantity: 250, unit: gram, food: pastryFood },
            { id: FLOUR_INGREDIENT, quantity: 1, unit: cup, food: flour },
          ],
          steps: [{ text: "Line the tin.", ingredientIds: [PASTRY_INGREDIENT, FLOUR_INGREDIENT] }],
        },
      ],
    })
  );
  recipeRepo.setImage(tart.id, `${tart.id}.jpg`);
  return { tart: recipeRepo.getById(tart.id)!, pastry };
}

// --- GET /api/recipes/:slug.json --------------------------------------------

test("one recipe's document comes back whole, with its links and its sub-recipe", async () => {
  const { tart, pastry } = await seed();
  const res = await handleRecipeJson("lemon-tart");
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toMatch(/application\/json/);

  const doc = (await res.json()) as Recipe;
  expect(doc.id).toBe(tart.id);
  expect(doc.slug).toBe("lemon-tart");
  expect(doc.tags.map((t) => t.name)).toEqual(["Dessert"]);

  const part = doc.parts[0]!;
  // The step keeps its links, in order, naming rows in the same part.
  expect(part.steps[0]!.ingredientIds).toEqual([PASTRY_INGREDIENT, FLOUR_INGREDIENT]);
  expect(part.ingredients.map((i) => i.id)).toEqual([PASTRY_INGREDIENT, FLOUR_INGREDIENT]);
  // The sub-recipe: the food says which recipe makes it.
  expect(part.ingredients[0]!.food?.recipeId).toBe(pastry.id);
  // The conversion rides along on the food.
  expect(part.ingredients[1]!.food?.conversions).toHaveLength(1);
  expect(part.ingredients[1]!.food?.aisle?.name).toBe("Baking");
});

test("the image is named by the URL that serves it, not by its file name", async () => {
  const { tart } = await seed();
  const doc = (await (await handleRecipeJson("lemon-tart")).json()) as Recipe;
  expect(doc.image).toBe(`/api/images/${tart.id}.jpg`);
});

test("a recipe with no image exports a null image", async () => {
  await seed();
  const doc = (await (await handleRecipeJson("sweet-pastry")).json()) as Recipe;
  expect(doc.image).toBeNull();
});

test.each([
  ["an unknown slug", "no-such-recipe"],
  ["an empty slug", ""],
  ["whitespace", "   "],
])("%s is 404 with an error message", async (_label, slug) => {
  await seed();
  const res = await handleRecipeJson(slug);
  expect(res.status).toBe(404);
  expect(typeof ((await res.json()) as { error: string }).error).toBe("string");
});

// --- GET /api/export.json ---------------------------------------------------

test("the whole export carries every recipe's document and the four reference lists", async () => {
  const { tart, pastry } = await seed();
  const res = await handleExportJson(new Date("2026-09-13T10:00:00.000Z"));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toMatch(/application\/json/);
  expect(res.headers.get("content-disposition")).toBe('attachment; filename="garnish-export-2026-09-13.json"');

  const body = (await res.json()) as GarnishExport;
  expect(body.garnish).toEqual({ version: 1, exportedAt: "2026-09-13T10:00:00.000Z" });
  expect(body.recipes.map((r) => r.slug)).toEqual(["lemon-tart", "sweet-pastry"]); // by name
  expect(body.recipes.find((r) => r.id === tart.id)?.image).toBe(`/api/images/${tart.id}.jpg`);

  // The sub-recipe survives as a food pointing at a recipe that is also in the file.
  const pastryFood = body.foods.find((f) => f.recipeId !== null);
  expect(pastryFood?.name).toBe("Sweet pastry");
  expect(body.recipes.some((r) => r.id === pastryFood?.recipeId)).toBe(true);
  expect(pastryFood?.recipeId).toBe(pastry.id);

  // The step links come through the documents, not a separate list.
  expect(body.recipes.find((r) => r.slug === "lemon-tart")?.parts[0]!.steps[0]!.ingredientIds).toEqual([PASTRY_INGREDIENT, FLOUR_INGREDIENT]);

  const flour = body.foods.find((f) => f.name === "Plain flour")!;
  expect(flour.conversions).toHaveLength(1);
  // A food names its aisle by id; the aisle list beside it resolves the name.
  expect(body.aisles.find((a) => a.id === flour.aisleId)?.name).toBe("Baking");
  expect(body.units.map((u) => u.name)).toContain("gram"); // the seeded reference list, whole
  expect(body.tags.map((t) => t.slug)).toEqual(["dessert"]);
});

test("a database with no recipes still exports a well-formed envelope", async () => {
  await getDb();
  const body = await buildExport(new Date("2026-09-13T10:00:00.000Z"));
  expect(body.garnish).toEqual({ version: 1, exportedAt: "2026-09-13T10:00:00.000Z" });
  expect(body.recipes).toEqual([]);
  expect(body.foods).toEqual([]);
  expect(body.aisles).toEqual([]);
  expect(body.tags).toEqual([]);
  expect(body.units.length).toBeGreaterThan(0); // seeded at boot, recipes or not
});

// --- GET /api/recipes/:slug.cook (M34.2) ------------------------------------

test("one recipe comes back as a Cooklang file, plain text", async () => {
  await seed();
  const res = await handleRecipeCook("lemon-tart");
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  const body = await res.text();
  expect(body).toContain(">> servings: 8");
  expect(body).toContain(">> tags: Dessert");
  // The linked ingredients come through as @ references.
  expect(body).toContain("@Plain flour");
  expect(body).toContain("@Sweet pastry");
});

test.each([
  ["an unknown slug", "no-such-recipe"],
  ["an empty slug", ""],
  ["whitespace", "   "],
])(".cook: %s is 404 with an error message", async (_label, slug) => {
  await seed();
  const res = await handleRecipeCook(slug);
  expect(res.status).toBe(404);
  expect(typeof ((await res.json()) as { error: string }).error).toBe("string");
});

// --- The routes -------------------------------------------------------------

test("the routes wire GET to the handlers, with the slug as a path param", async () => {
  const { tart } = await seed();

  const recipeGet = handlersOf(RecipeJsonRoute).GET!;
  expect(typeof recipeGet).toBe("function");
  expect(handlersOf(RecipeJsonRoute).POST).toBeUndefined();
  const one = await recipeGet({
    request: new Request("http://localhost/api/recipes/lemon-tart.json"),
    params: { slug: "lemon-tart" },
  });
  expect(((await one.json()) as Recipe).id).toBe(tart.id);

  const exportGet = handlersOf(ExportRoute).GET!;
  expect(typeof exportGet).toBe("function");
  expect(handlersOf(ExportRoute).POST).toBeUndefined();
  const all = await exportGet({ request: new Request("http://localhost/api/export.json"), params: {} });
  expect(((await all.json()) as GarnishExport).recipes).toHaveLength(2);

  const cookGet = handlersOf(RecipeCookRoute).GET!;
  expect(typeof cookGet).toBe("function");
  expect(handlersOf(RecipeCookRoute).POST).toBeUndefined();
  const cook = await cookGet({
    request: new Request("http://localhost/api/recipes/lemon-tart.cook"),
    params: { slug: "lemon-tart" },
  });
  expect(await cook.text()).toContain(">> servings: 8");
});

test("the route paths carry the .json and .cook suffixes, with the slug still its own param", () => {
  testRouter("/"); // a route learns its full path when a router builds the tree
  // `{$slug}` ends the param before the suffix, so `lemon-tart.json` is the
  // slug `lemon-tart` — the reason a fallback /json path was not needed.
  expect(RecipeJsonRoute.fullPath).toBe("/api/recipes/{$slug}.json");
  expect(ExportRoute.fullPath).toBe("/api/export.json");
  expect(RecipeCookRoute.fullPath).toBe("/api/recipes/{$slug}.cook");
});
