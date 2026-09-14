// M32.3 end to end on the view route: the loader fetches the recipes its
// ingredient foods are made by, and the row renders the food as a link to the
// child with the derived servings under it.
import { afterEach, expect, test, vi } from "vitest";
import { foodForRecipe } from "../../../../src/server/fns/foods";
import { createRecipe } from "../../../../src/server/fns/recipes";
import { findOrCreateUnit } from "../../../../src/server/fns/units";
import { renderRoute } from "../../../helpers/routes";
import { callServerFn, useTempDataDir } from "../../../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../../../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../../../src/server/fns/recipes", local);
vi.mock("../../../../src/server/fns/timeline", local);
vi.mock("../../../../src/server/fns/foods", local);
vi.mock("../../../../src/server/fns/units", local);

useTempDataDir();
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

/** A pastry recipe yielding 500 g at 4 servings, made into a food, used 250 g at a time by a tart. */
async function seedTartOverPastry(quantity: number, unitName: string) {
  const gram = await callServerFn(findOrCreateUnit, { name: "gram" });
  const unit = unitName === "gram" ? gram : await callServerFn(findOrCreateUnit, { name: unitName });
  const pastry = await callServerFn(createRecipe, {
    name: "Sweet pastry",
    recipeServings: 4,
    recipeYieldQuantity: 500,
    yieldUnit: gram,
    parts: [{ name: "", steps: [{ text: "Rub it together." }] }],
  });
  const food = await callServerFn(foodForRecipe, { recipeId: pastry.id });
  await callServerFn(createRecipe, {
    name: "Lemon tart",
    recipeServings: 8,
    parts: [
      {
        name: "",
        ingredients: [{ quantity, unit, food: { id: food.id, name: food.name } }],
        steps: [{ text: "Line the tin." }],
      },
    ],
  });
}

test("an ingredient made by a recipe links to it and says how many servings to make", async () => {
  await seedTartOverPastry(250, "gram");
  const html = await renderRoute("/recipes/lemon-tart");
  expect(html).toContain('data-sub-recipe="true"');
  expect(html).toContain('href="/recipes/sweet-pastry"');
  expect(html).toContain("Make 2 servings");
});

test("the hint follows the page's scale, because the row is scaled before it is derived", async () => {
  await seedTartOverPastry(250, "gram");
  const html = await renderRoute("/recipes/lemon-tart?servings=16");
  expect(html).toContain('href="/recipes/sweet-pastry"');
  expect(html).toContain("Make 4 servings");
});

test("an amount the child's yield cannot be related to keeps the link and drops the hint", async () => {
  await seedTartOverPastry(1, "cup");
  const html = await renderRoute("/recipes/lemon-tart");
  expect(html).toContain('href="/recipes/sweet-pastry"');
  expect(html).not.toContain('data-testid="sub-recipe-hint"');
});
