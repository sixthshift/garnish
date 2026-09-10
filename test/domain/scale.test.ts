import { describe, expect, test } from "vitest";
import { type Recipe, recipeSchema } from "../../src/domain/recipe";
import { ScaleError, scaleRecipe } from "../../src/domain/scale";

const ids = {
  recipe: "11111111-1111-4111-8111-111111111111",
  sauce: "22222222-2222-4222-8222-222222222222",
  pasta: "33333333-3333-4333-8333-333333333333",
  butter: "44444444-4444-4444-8444-444444444444",
  bayLeaf: "55555555-5555-4555-8555-555555555555",
  salt: "66666666-6666-4666-8666-666666666666",
  spaghetti: "77777777-7777-4777-8777-777777777777",
  step: "88888888-8888-4888-8888-888888888888",
};

const now = "2026-09-10T00:00:00.000Z";

function fixture(overrides: Partial<Recipe> = {}): Recipe {
  return recipeSchema.parse({
    id: ids.recipe,
    slug: "buttered-spaghetti",
    name: "Buttered spaghetti",
    recipeServings: 4,
    recipeYieldQuantity: 800,
    components: [
      {
        id: ids.sauce,
        name: "Sauce",
        ingredients: [
          { id: ids.butter, quantity: 50 },
          { id: ids.bayLeaf, quantity: 1, fixed: true },
          { id: ids.salt, quantity: null },
        ],
        steps: [{ id: ids.step, text: "Melt the butter." }],
      },
      {
        id: ids.pasta,
        name: "Pasta",
        ingredients: [{ id: ids.spaghetti, quantity: 400 }],
      },
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function quantities(doc: Recipe) {
  return doc.components.flatMap((c) => c.ingredients.map((i) => i.quantity));
}

describe("scaleRecipe", () => {
  test("factor 2 doubles linear ingredients and the yield", () => {
    const out = scaleRecipe(fixture(), 8);
    expect(out.recipeServings).toBe(8);
    expect(out.recipeYieldQuantity).toBe(1600);
    expect(quantities(out)).toEqual([100, 1, null, 800]);
  });

  test("factor 0.5 halves linear ingredients and the yield", () => {
    const out = scaleRecipe(fixture(), 2);
    expect(out.recipeServings).toBe(2);
    expect(out.recipeYieldQuantity).toBe(400);
    expect(quantities(out)).toEqual([25, 1, null, 200]);
  });

  test("fixed ingredients keep their quantity", () => {
    const out = scaleRecipe(fixture(), 12);
    const bayLeaf = out.components[0]!.ingredients[1]!;
    expect(bayLeaf.fixed).toBe(true);
    expect(bayLeaf.quantity).toBe(1);
  });

  test("null quantity stays null", () => {
    const out = scaleRecipe(fixture(), 12);
    expect(out.components[0]!.ingredients[2]!.quantity).toBeNull();
  });

  test("a yield of 0 (none recorded) stays 0", () => {
    const out = scaleRecipe(fixture({ recipeYieldQuantity: 0 }), 8);
    expect(out.recipeYieldQuantity).toBe(0);
  });

  test("same servings returns an equal document", () => {
    const input = fixture();
    expect(scaleRecipe(input, 4)).toEqual(input);
  });

  test("does not mutate the input", () => {
    const input = fixture();
    const snapshot = structuredClone(input);
    const out = scaleRecipe(input, 8);
    expect(input).toEqual(snapshot);
    expect(out).not.toBe(input);
    expect(out.components[0]).not.toBe(input.components[0]);
    expect(out.components[0]!.ingredients[0]).not.toBe(input.components[0]!.ingredients[0]);
  });

  test("output still satisfies the recipe schema", () => {
    expect(() => recipeSchema.parse(scaleRecipe(fixture(), 6))).not.toThrow();
  });

  test("rejects servings of 0", () => {
    expect(() => scaleRecipe(fixture(), 0)).toThrow(ScaleError);
    expect(() => scaleRecipe(fixture(), 0)).toThrow(/greater than 0/);
  });

  test("rejects negative and non-finite servings", () => {
    expect(() => scaleRecipe(fixture(), -2)).toThrow(ScaleError);
    expect(() => scaleRecipe(fixture(), Number.NaN)).toThrow(ScaleError);
    expect(() => scaleRecipe(fixture(), Number.POSITIVE_INFINITY)).toThrow(ScaleError);
  });

  test("throws when the recipe has no servings to scale from", () => {
    const input = fixture({ recipeServings: 0 });
    expect(() => scaleRecipe(input, 4)).toThrow(ScaleError);
    expect(() => scaleRecipe(input, 4)).toThrow(/cannot be scaled/);
  });
});
