// The "Add to shopping list" sheet (M31.3): its pure row builders, and what
// AddToShoppingSheetContent renders.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AddToShoppingSheetContent, additionsFor, ingredientText, shoppingGroups } from "../../src/components/AddToShoppingSheet";
import type { Food, Ingredient, Part, Recipe, Unit } from "../../src/domain/recipe";

const food = (name: string, skipShopping = false): Food => ({
  id: `food-${name}`,
  name,
  pluralName: null,
  aliases: [],
  aisle: null,
  recipeId: null,
  skipShopping,
  conversions: [],
});

const gram: Unit = { id: "unit-g", name: "gram", pluralName: "grams", abbreviation: "g", useAbbreviation: true, fraction: false, standardQuantity: null, standardUnitId: null };

let n = 0;
function ingredient(overrides: Partial<Ingredient> = {}): Ingredient {
  n += 1;
  return { id: `ing-${n}`, quantity: null, unit: null, food: null, note: "", originalText: "", fixed: false, ...overrides };
}

function part(name: string, ingredients: Ingredient[]): Part {
  return { id: `part-${name || "main"}`, name, ingredients, steps: [] };
}

function recipeWith(parts: Part[], recipeServings = 4): Recipe {
  return {
    id: "recipe-1",
    slug: "lemon-tart",
    name: "Lemon tart",
    description: "",
    image: null,
    rating: null,
    lastMade: null,
    recipeServings,
    recipeYieldQuantity: 0,
    yieldUnit: null,
    recipeYield: "",
    prepTime: null,
    performTime: null,
    sourceUrl: null,
    favourite: false,
    notes: [],
    tags: [],
    parts,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const flour = () => ingredient({ quantity: 400, unit: gram, food: food("flour") });
const salt = () => ingredient({ quantity: 1, food: food("salt", true) });
const freeText = () => ingredient({ originalText: "a splash of vanilla" });

describe("ingredientText", () => {
  test("prefers the original text", () => {
    expect(ingredientText(freeText())).toBe("a splash of vanilla");
  });

  test("falls back to the formatted line when there is no original", () => {
    expect(ingredientText(flour())).toContain("flour");
  });
});

describe("shoppingGroups", () => {
  test("keeps parts in order and drops the ones with nothing to buy", () => {
    const groups = shoppingGroups(recipeWith([part("Pastry", [flour()]), part("Filling", []), part("", [freeText()])]));
    expect(groups.map((g) => g.name)).toEqual(["Pastry", ""]);
  });

  test("drops an on-hand food: it can never reach the list", () => {
    const groups = shoppingGroups(recipeWith([part("", [flour(), salt()])]));
    expect(groups[0]!.ingredients.map((i) => i.food?.name)).toEqual(["flour"]);
  });

  test("drops a row with neither a food nor any text", () => {
    expect(shoppingGroups(recipeWith([part("", [ingredient()])]))).toEqual([]);
  });
});

describe("additionsFor", () => {
  test("stamps every row with the recipe, its part and the servings shown", () => {
    const additions = additionsFor(recipeWith([part("Pastry", [flour()])], 8));
    expect(additions).toHaveLength(1);
    expect(additions[0]!.quantity).toBe(400);
    expect(additions[0]!.source).toEqual({ recipeId: "recipe-1", recipeName: "Lemon tart", partName: "Pastry", servings: 8 });
  });

  test("a recipe with no servings recorded carries no scale on its sources", () => {
    expect(additionsFor(recipeWith([part("", [flour()])], 0))[0]!.source.servings).toBeNull();
  });

  test("excluded ids are left out", () => {
    const kept = flour();
    const dropped = ingredient({ quantity: 2, food: food("lemon") });
    const additions = additionsFor(recipeWith([part("", [kept, dropped])]), new Set([dropped.id]));
    expect(additions.map((a) => a.food?.name)).toEqual(["flour"]);
  });
});

describe("AddToShoppingSheetContent render", () => {
  const render = (recipe: Recipe, busy = false) => renderToString(<AddToShoppingSheetContent recipe={recipe} busy={busy} onAdd={() => {}} onCancel={() => {}} />);

  test("lists every buyable ingredient, ticked to include", () => {
    const html = render(recipeWith([part("", [flour(), freeText(), salt()])]));
    expect(html).toContain("Add to shopping list");
    expect(html.match(/data-testid="shopping-sheet-row"/g)).toHaveLength(2);
    expect(html).not.toContain("salt");
    expect(html).toContain('data-included="true"');
    expect(html).not.toContain('data-included="false"');
    expect(html).toContain("a splash of vanilla");
  });

  test("shows the scaled amount, not the stored one", () => {
    expect(render(recipeWith([part("", [flour()])], 8))).toContain("400");
  });

  test("a multi-part recipe gets a heading per named part; the unnamed part gets none", () => {
    const html = render(recipeWith([part("Pastry", [flour()]), part("", [freeText()])]));
    expect(html).toContain("Pastry");
    expect(html).toContain('aria-label="Pastry"');
    expect(html.match(/<section/g)).toHaveLength(2);
  });

  test("offers Add and Cancel, with Add live", () => {
    const html = render(recipeWith([part("", [flour()])]));
    expect(html).toContain(">Add<");
    expect(html).toContain(">Cancel<");
  });

  test("a recipe with nothing to buy says so and cannot be added", () => {
    const html = render(recipeWith([part("", [salt()])]));
    expect(html).toContain("Nothing to add");
    expect(html).not.toContain('data-testid="shopping-sheet-row"');
    expect(html).toMatch(/disabled/);
  });

  test("while adding, the buttons are disabled", () => {
    const html = render(recipeWith([part("", [flour()])]), true);
    expect(html).toContain("Adding…");
    expect(html).toContain("disabled");
  });
});
