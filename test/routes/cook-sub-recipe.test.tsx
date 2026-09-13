// M32.4 end to end on the cook route: a step card whose linked ingredient is a
// sub-recipe offers a link into the child's own cook mode at the derived
// servings, carrying this recipe's slug as `?from=`; the child's Finished card
// offers a way back when it was entered that way. See src/routes/recipes/$slug/cook.tsx.
import { afterEach, expect, test, vi } from "vitest";
import { foodForRecipe } from "../../src/server/foods";
import { createRecipe } from "../../src/server/recipes";
import { findOrCreateUnit } from "../../src/server/units";
import { renderRoute } from "../helpers/routes";
import { callServerFn, useTempDataDir } from "../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../src/server/recipes", local);
vi.mock("../../src/server/timeline", local);
vi.mock("../../src/server/foods", local);
vi.mock("../../src/server/units", local);

useTempDataDir();
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

/** Sweet pastry (500 g at 4 servings, one step), used 250 g at a time by a tart's own step. */
async function seedTartOverPastry() {
  const gram = await callServerFn(findOrCreateUnit, { name: "gram" });
  const pastry = await callServerFn(createRecipe, {
    name: "Sweet pastry",
    recipeServings: 4,
    recipeYieldQuantity: 500,
    yieldUnit: gram,
    parts: [{ name: "", steps: [{ text: "Rub it together." }] }],
  });
  const pastryFood = await callServerFn(foodForRecipe, { recipeId: pastry.id });
  const ingredientId = crypto.randomUUID();
  await callServerFn(createRecipe, {
    name: "Lemon tart",
    recipeServings: 8,
    parts: [
      {
        name: "",
        ingredients: [{ id: ingredientId, quantity: 250, unit: gram, food: { id: pastryFood.id, name: pastryFood.name } }],
        steps: [{ text: "Roll out the pastry.", ingredientIds: [ingredientId] }],
      },
    ],
  });
  return pastry;
}

test("a step card whose linked ingredient is a sub-recipe offers a link into the child's cook mode at the derived servings", async () => {
  await seedTartOverPastry();
  const html = await renderRoute("/recipes/lemon-tart/cook");
  expect(html).toContain('data-card="step"');
  // The food name still links to the child's view page...
  expect(html).toContain('data-testid="sub-recipe-link"');
  expect(html).toContain('href="/recipes/sweet-pastry"');
  // ...and the hint is a link into its cook mode instead of plain text.
  expect(html).not.toContain('data-testid="sub-recipe-hint"');
  expect(html).toContain('data-testid="sub-recipe-cook-link"');
  expect(html).toMatch(/data-testid="sub-recipe-cook-link"[^>]*>Open Sweet pastry at 2 servings</);

  const href = html.match(/href="(\/recipes\/sweet-pastry\/cook[^"]*)"/)?.[1];
  expect(href).toBeDefined();
  const url = new URL(href!.replace(/&amp;/g, "&"), "http://test");
  expect(url.pathname).toBe("/recipes/sweet-pastry/cook");
  expect(url.searchParams.get("servings")).toBe("2");
  expect(url.searchParams.get("from")).toBe("lemon-tart");
});

test("the child's Finished card offers a way back when entered through the link's `from`", async () => {
  await seedTartOverPastry();
  // Sweet pastry has one step and no ingredients card, so step 1 is Finished.
  const html = await renderRoute("/recipes/sweet-pastry/cook?step=1&from=lemon-tart");
  expect(html).toContain('data-card="finished"');
  expect(html).toContain('data-testid="back-to-parent"');
  expect(html).toMatch(/data-testid="back-to-parent"[^>]*>[\s\S]*?Back to[\s\S]*?Lemon tart[\s\S]*?<\/a>/);
  expect(html).toContain('href="/recipes/lemon-tart/cook"');
});

test("no `from`: the Finished card offers no way back", async () => {
  await seedTartOverPastry();
  const html = await renderRoute("/recipes/sweet-pastry/cook?step=1");
  expect(html).toContain('data-card="finished"');
  expect(html).not.toContain('data-testid="back-to-parent"');
});

test("a stale `from` that no longer resolves drops the way back, without failing the page", async () => {
  await seedTartOverPastry();
  const html = await renderRoute("/recipes/sweet-pastry/cook?step=1&from=does-not-exist");
  expect(html).toContain('data-card="finished"');
  expect(html).not.toContain('data-testid="back-to-parent"');
});
