// M24.6: the phone's ingredients sheet. Its body renders on its own (the Sheet
// shell only paints once mounted on a client), so the content component is
// what these exercise: one merged list in summary mode, a list per part in
// structured mode, and the rows sharing the page's session ticks.
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test } from "vitest";
import { IngredientsSheetContent } from "../../src/components/IngredientsSheet";
import { IngredientList } from "../../src/components/IngredientList";
import type { Ingredient, Recipe } from "../../src/domain/recipe";
import { subscribeTicks, toggleIngredientTickNow, type StorageLike } from "../../src/lib/ticks";

const flour = { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", name: "flour", pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false };
const sugar = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "sugar", pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false };

const ingredient = (id: string, food: typeof flour, quantity: number): Ingredient => ({
  id,
  quantity,
  unit: null,
  food,
  note: "",
  originalText: "",
  fixed: false,
});

const PASTRY_FLOUR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const FILLING_SUGAR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const BODY_FLOUR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";

const recipe: Recipe = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "lemon-tart",
  name: "Lemon tart",
  description: "",
  image: null,
  rating: null,
  lastMade: null,
  favourite: false,
  recipeServings: 4,
  recipeYieldQuantity: 0,
  yieldUnit: null,
  recipeYield: "",
  prepTime: null,
  performTime: null,
  sourceUrl: null,
  notes: [],
  tags: [],
  parts: [
    { id: "22222222-2222-4222-8222-222222222221", name: "Pastry", ingredients: [ingredient(PASTRY_FLOUR, flour, 200)], steps: [] },
    { id: "22222222-2222-4222-8222-222222222222", name: "Filling", ingredients: [ingredient(FILLING_SUGAR, sugar, 100)], steps: [] },
    { id: "22222222-2222-4222-8222-222222222223", name: "", ingredients: [ingredient(BODY_FLOUR, flour, 50)], steps: [] },
  ],
  createdAt: "2026-03-04T02:30:00.000Z",
  updatedAt: "2026-03-04T02:30:00.000Z",
};

/** An in-memory sessionStorage, so the rows read what a test seeds. */
function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("IngredientsSheetContent", () => {
  test("summary mode: one merged list, the two flours added together", () => {
    const html = renderToString(<IngredientsSheetContent recipe={recipe} summary />);

    expect(count(html, 'aria-label="Ingredients"')).toBe(1);
    expect(html).toContain("250"); // 200 g of flour in the pastry plus 50 in the body
    expect(html).toContain("flour");
    expect(html).toContain("sugar");
    // No part headings in summary mode: the merged list has nothing to head.
    expect(html).not.toContain("Pastry");
    expect(html).not.toContain("Filling");
  });

  test("structured mode: a list per part with ingredients, under the part's name", () => {
    const html = renderToString(<IngredientsSheetContent recipe={recipe} summary={false} />);

    expect(count(html, 'aria-label="Ingredients"')).toBe(3);
    expect(html).toContain('aria-label="Pastry ingredients"');
    expect(html).toContain('aria-label="Filling ingredients"');
    expect(html).toContain("200");
    expect(html).toContain("100");
    expect(html).toContain("50");
    // The unnamed part is the main body and carries no heading, as in Mealie.
    expect(count(html, "<h2")).toBe(3); // the sheet's own title plus the two named parts
  });

  test("a part with no ingredients contributes nothing", () => {
    const empty: Recipe = { ...recipe, parts: [recipe.parts[0]!, { id: "22222222-2222-4222-8222-222222222224", name: "Glaze", ingredients: [], steps: [] }] };
    const html = renderToString(<IngredientsSheetContent recipe={empty} summary={false} />);

    expect(html).not.toContain("Glaze");
    expect(count(html, 'aria-label="Ingredients"')).toBe(1);
  });

  test("the sheet's rows carry no per-row 'Scale to...': that control lives in the aside's heading", () => {
    expect(renderToString(<IngredientsSheetContent recipe={recipe} summary />)).not.toContain('data-testid="scale-to-trigger"');
  });

  test("scaled marks the amounts, as the page's rows do", () => {
    expect(renderToString(<IngredientsSheetContent recipe={recipe} summary scaled />)).toContain('data-scaled="true"');
  });
});

describe("ticks are shared between the sheet and the page", () => {
  test("ticking in the sheet ticks the row on the page", () => {
    const storage = fakeStorage();
    (globalThis as { window?: unknown }).window = { sessionStorage: storage };

    // The page's aside and the sheet render the same ingredient, both unticked.
    const page = () => renderToString(<IngredientList ingredients={[ingredient(PASTRY_FLOUR, flour, 200)]} recipeId={recipe.id} currentServings={4} onScaleTo={() => {}} />);
    expect(page()).not.toContain('data-ticked="true"');
    expect(renderToString(<IngredientsSheetContent recipe={recipe} summary={false} />)).not.toContain('data-ticked="true"');

    // A mounted row subscribes to the store; standing in for that subscription
    // here, since there is no DOM under vitest to click the sheet's checkbox in.
    let notified = 0;
    const unsubscribe = subscribeTicks(() => {
      notified += 1;
    });

    // What the sheet's row does when its checkbox is ticked.
    toggleIngredientTickNow(recipe.id, PASTRY_FLOUR);

    expect(notified).toBe(1);
    expect(page()).toContain('data-ticked="true"');
    expect(renderToString(<IngredientsSheetContent recipe={recipe} summary={false} />)).toContain('data-ticked="true"');

    unsubscribe();
    toggleIngredientTickNow(recipe.id, PASTRY_FLOUR);
    expect(notified).toBe(1); // unsubscribed
    expect(page()).not.toContain('data-ticked="true"');
  });

  test("only the ticked ingredient strikes through, not every row", () => {
    (globalThis as { window?: unknown }).window = { sessionStorage: fakeStorage() };
    toggleIngredientTickNow(recipe.id, FILLING_SUGAR);

    const html = renderToString(<IngredientsSheetContent recipe={recipe} summary={false} />);
    expect(count(html, 'data-ticked="true"')).toBe(1);
  });
});
