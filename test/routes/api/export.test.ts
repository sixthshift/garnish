// The export routes (M34.1, M34.2) against a temp DATA_DIR: one recipe's
// document and its Cooklang file — the whole database is a backup now
// (test/server/backup, decisions.md row 131) — over a fixture that exercises the parts of the
// document an export is most likely to lose — a step linked to its ingredient
// rows, an ingredient whose food is made by another recipe, a food conversion,
// an aisle, a tag, and an image.
import { expect, test } from "vitest";
import { aisleRepository } from "../../../src/db/models/aisle/repo";
import { foodRepository } from "../../../src/db/models/food/repo";
import { recipeRepository } from "../../../src/db/models/recipe/repo";
import { tagRepository } from "../../../src/db/models/tag/repo";
import { unitRepository } from "../../../src/db/models/unit/repo";
import { type Recipe, recipeInputSchema } from "../../../src/domain/recipe";
import { recipeCookRoute as RecipeCookRoute, recipeJsonRoute as RecipeJsonRoute } from "../../../src/routes/api/export";
import { handleRecipeCook, handleRecipeJson } from "../../../src/server/api/export";
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
  const db = getDb();
  const recipeRepo = recipeRepository(db);
  const unitRepo = unitRepository(db);
  const foodRepo = foodRepository(db);

  // The seed has already created the common units, so take them as they are.
  const gram = unitRepo.getByName("gram") ?? unitRepo.create({ name: "gram", abbreviation: "g" });
  const cup = unitRepo.getByName("cup") ?? unitRepo.create({ name: "cup" });
  const baking = aisleRepository(db).create({ name: "Baking" });
  const dessert = tagRepository(db).create({ name: "Dessert" });

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
  recipeRepo.ref(tart.id).setImage(`${tart.id}.jpg`);
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
  expect(RecipeCookRoute.fullPath).toBe("/api/recipes/{$slug}.cook");
});
