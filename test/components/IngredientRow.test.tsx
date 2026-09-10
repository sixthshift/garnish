// IngredientRow: its pure line-splitting helper, and the rendered row for the
// three cases the task calls out — ticked, scaled and fixed.
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test } from "vitest";
import { IngredientRow, ingredientLineParts } from "../../src/components/IngredientRow";
import type { Ingredient } from "../../src/domain/recipe";
import { setIngredientTicked, type StorageLike } from "../../src/lib/ticks";

const gram = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
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
};

const RECIPE_ID = "11111111-1111-4111-8111-111111111111";

const ingredient = (overrides: Partial<Ingredient> = {}): Ingredient => ({
  id: "22222222-2222-4222-8222-222222222222",
  quantity: 250,
  unit: gram,
  food: flour,
  note: "",
  originalText: "",
  fixed: false,
  ...overrides,
});

describe("ingredientLineParts", () => {
  test("amount and bold-able food, split apart", () => {
    expect(ingredientLineParts(ingredient())).toEqual({ amount: "250 g", food: "flour", raw: false });
  });

  test("no quantity: no amount, just the food", () => {
    expect(ingredientLineParts(ingredient({ quantity: null, unit: null }))).toEqual({ amount: "", food: "flour", raw: false });
  });

  test("no food but an originalText: the raw line, unstyled", () => {
    expect(ingredientLineParts(ingredient({ food: null, originalText: "a handful of basil" }))).toEqual({
      amount: "",
      food: "a handful of basil",
      raw: true,
    });
  });
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
});
