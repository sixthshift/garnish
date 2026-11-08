// IngredientRow: the rendered row for the three cases the task calls out —
// ticked, scaled and fixed.
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test } from "vitest";
import { SubRecipesProvider } from "../../../../../src/components/recipe/SubRecipes";
import { IngredientRow } from "../../../../../src/domain/recipes/components/recipe/IngredientRow";
import type { Ingredient, SubRecipe } from "../../../../../src/domain/recipes/recipe";
import type { StorageLike } from "../../../../../src/lib/storage";
import { setIngredientTicked } from "../../../../../src/lib/ticks";

const gram = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  portion: false,
  standardQuantity: null,
  standardUnitId: null,
};

const flour = {
  id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  name: "flour",
  pluralName: null,
  aliases: [],
  aisle: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};

const RECIPE_ID = "11111111-1111-4111-8111-111111111111";

const ingredient = (overrides: Partial<Ingredient> = {}): Ingredient => ({
  id: "22222222-2222-4222-8222-222222222222",
  quantity: 250,
  quantityMax: null,
  unit: gram,
  food: flour,
  note: "",
  originalText: "",
  fixed: false,
  alternatives: [],
  ...overrides,
});

/** A window whose sessionStorage is real (an in-memory StorageLike), so useIngredientTick reads what a test seeds. */
function fakeStorage(): StorageLike & { size: () => number } {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    size: () => map.size,
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("IngredientRow", () => {
  test("renders quantity, unit, bold food", () => {
    const html = renderToString(<IngredientRow recipeId={RECIPE_ID} ingredient={ingredient()} />);
    expect(html).toContain("250");
    expect(html).toContain("g");
    expect(html).toContain("<strong");
    expect(html).toContain("flour");
    expect(html).toMatch(/<strong[^>]*>flour<\/strong>/);
  });

  test("note renders dimmed on its own line, separate from the amount/food line", () => {
    const html = renderToString(<IngredientRow recipeId={RECIPE_ID} ingredient={ingredient({ note: "sifted" })} />);
    expect(html).toMatch(/<p[^>]*>sifted<\/p>/);
  });

  test("alternatives show under the line at its amount, in order, each with its note", () => {
    const sugar = { ...flour, id: "33333333-3333-4333-8333-333333333333", name: "sugar" };
    const rice = { ...flour, id: "44444444-4444-4444-8444-444444444444", name: "rice flour" };
    const perHundred = { basisQuantity: 100, basisUnit: gram, note: "denser", planPicks: false, items: [{ quantity: 90, unit: gram, food: rice }] };
    const straight = { basisQuantity: null, basisUnit: null, note: "", planPicks: true, items: [{ quantity: null, unit: null, food: sugar }] };

    const html = renderToString(<IngredientRow recipeId={RECIPE_ID} ingredient={ingredient({ alternatives: [perHundred, straight] })} />);
    expect(html).toContain('data-testid="ingredient-alternatives"');
    // 250 g at 90 g per 100 g; then sugar one for one.
    const text = html.replaceAll("<!-- -->", "");
    expect(text).toMatch(/or 225 g rice flour · denser<\/span><span>or 250 g sugar/);

    expect(renderToString(<IngredientRow recipeId={RECIPE_ID} ingredient={ingredient()} />)).not.toContain("ingredient-alternatives");
  });

  test("fixed marker is kept", () => {
    const html = renderToString(<IngredientRow recipeId={RECIPE_ID} ingredient={ingredient({ fixed: true })} />);
    expect(html).toContain('data-fixed="true"');
    expect(html).toContain("fixed");
  });

  test("no fixed marker when not fixed", () => {
    const html = renderToString(<IngredientRow recipeId={RECIPE_ID} ingredient={ingredient({ fixed: false })} />);
    expect(html).not.toContain('data-fixed="true"');
  });

  test("scaled adds a class to the amount only, not the food", () => {
    const scaledHtml = renderToString(<IngredientRow recipeId={RECIPE_ID} ingredient={ingredient()} scaled />);
    expect(scaledHtml).toContain('data-scaled="true"');
    expect(scaledHtml).toMatch(/class="[^"]*text-fg-brand[^"]*" data-testid="ingredient-amount"/);
    expect(scaledHtml).not.toMatch(/<strong[^>]*text-fg-brand/);

    const unscaledHtml = renderToString(<IngredientRow recipeId={RECIPE_ID} ingredient={ingredient()} scaled={false} />);
    expect(unscaledHtml).not.toContain('data-scaled="true"');
    expect(unscaledHtml).not.toContain("text-fg-brand");
  });

  test("a ticked ingredient renders checked and strikes its text through", () => {
    const storage = fakeStorage();
    setIngredientTicked(storage, RECIPE_ID, ingredient().id, true);
    (globalThis as { window?: unknown }).window = { sessionStorage: storage };

    const html = renderToString(<IngredientRow recipeId={RECIPE_ID} ingredient={ingredient()} />);
    expect(html).toContain('data-ticked="true"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toMatch(/class="[^"]*line-through/);
  });

  test("an unticked ingredient renders unchecked with no strike-through", () => {
    const storage = fakeStorage();
    (globalThis as { window?: unknown }).window = { sessionStorage: storage };

    const html = renderToString(<IngredientRow recipeId={RECIPE_ID} ingredient={ingredient()} />);
    expect(html).not.toContain('data-ticked="true"');
    expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain("line-through");
  });

  test("M25.2: no row renders a 'Scale to...' trigger — that control moved into the servings popover", () => {
    const html = renderToString(<IngredientRow recipeId={RECIPE_ID} ingredient={ingredient()} />);
    expect(html).not.toContain('data-testid="scale-to-trigger"');
  });
});

// --- A food made by a recipe (M32.3) ---------------------------------------

const PASTRY_RECIPE_ID = "33333333-3333-4333-8333-333333333333";

const pastry = {
  ...flour,
  id: "44444444-4444-4444-8444-444444444444",
  name: "pastry",
  recipeId: PASTRY_RECIPE_ID,
};

const pastryRecipe: SubRecipe = {
  id: PASTRY_RECIPE_ID,
  slug: "sweet-pastry",
  name: "Sweet pastry",
  recipeServings: 4,
  recipeYieldQuantity: 500,
  yieldUnit: gram,
};

/** Render the row inside a throwaway router and the sub-recipes it knows about, so its `Link`s resolve. */
async function renderRow(row: Ingredient, subRecipes: SubRecipe[]): Promise<string> {
  const rootRoute = createRootRoute({
    component: () => (
      <SubRecipesProvider subRecipes={subRecipes}>
        <ul>
          <IngredientRow recipeId={RECIPE_ID} ingredient={row} />
        </ul>
      </SubRecipesProvider>
    ),
  });
  const slugRoute = createRoute({ getParentRoute: () => rootRoute, path: "/recipes/$slug", component: () => null });
  const router = createRouter({
    routeTree: rootRoute.addChildren([slugRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

describe("a food made by a recipe", () => {
  test("the food is a link to the child, with the derived servings as a hint", async () => {
    const html = await renderRow(ingredient({ quantity: 250, unit: gram, food: pastry }), [pastryRecipe]);
    expect(html).toContain('data-sub-recipe="true"');
    expect(html).toContain('data-testid="sub-recipe-link"');
    expect(html).toContain('href="/recipes/sweet-pastry?servings=2"');
    expect(html).toMatch(/data-testid="sub-recipe-link"[^>]*>pastry</);
    // 250 g of a child yielding 500 g at 4 servings: half a batch.
    expect(html).toContain("Make 2 servings");
    // The body is no longer the tick toggle: an anchor inside a button is not markup.
    expect(html).not.toMatch(/<button[^>]*>\s*<span[^>]*>\s*<span[^>]*data-testid="ingredient-amount"/);
  });

  test("an amount that cannot be related to the child's yield gets the link and no hint", async () => {
    const cup = { ...gram, id: "55555555-5555-4555-8555-555555555555", name: "cup", abbreviation: "cup", useAbbreviation: false };
    const html = await renderRow(ingredient({ quantity: 1, unit: cup, food: pastry }), [pastryRecipe]);
    expect(html).toContain('data-testid="sub-recipe-link"');
    expect(html).not.toContain('data-testid="sub-recipe-hint"');
    expect(html).not.toContain("Make ");
  });

  // Row 214: with cook mode gone, the food's own link opens the child at the
  // servings this line needs of it.
  test("the food's link opens the child at the servings the line needs", async () => {
    const html = await renderRow(ingredient({ quantity: 250, unit: gram, food: pastry }), [pastryRecipe]);
    expect(html).toContain('href="/recipes/sweet-pastry?servings=2"');
  });

  test("a food whose recipe the page did not fetch is an ordinary bold row", async () => {
    const html = await renderRow(ingredient({ food: pastry }), []);
    expect(html).not.toContain('data-sub-recipe="true"');
    expect(html).not.toContain('data-testid="sub-recipe-link"');
    expect(html).toMatch(/<strong[^>]*>pastry<\/strong>/);
  });

  test("an ordinary food is untouched inside the provider", async () => {
    const html = await renderRow(ingredient(), [pastryRecipe]);
    expect(html).not.toContain('data-sub-recipe="true"');
    expect(html).toMatch(/<strong[^>]*>flour<\/strong>/);
  });
});
