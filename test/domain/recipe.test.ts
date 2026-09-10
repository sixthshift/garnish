import { describe, expect, test } from "vitest";
import {
  type Recipe,
  type RecipeInput,
  recipeInputSchema,
  recipeSchema,
} from "../../src/domain/recipe";

const ids = {
  recipe: "11111111-1111-4111-8111-111111111111",
  sauce: "22222222-2222-4222-8222-222222222222",
  pasta: "33333333-3333-4333-8333-333333333333",
  ing1: "44444444-4444-4444-8444-444444444444",
  ing2: "55555555-5555-4555-8555-555555555555",
  ing3: "66666666-6666-4666-8666-666666666666",
  step1: "77777777-7777-4777-8777-777777777777",
  step2: "88888888-8888-4888-8888-888888888888",
  step3: "99999999-9999-4999-8999-999999999999",
  note: "00000000-0000-4000-8000-000000000000",
  g: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  serve: "abababab-abab-4bab-8bab-abababababab",
  butter: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  spaghetti: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  salt: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  dairy: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  tag: "ffffffff-ffff-4fff-8fff-ffffffffffff",
};

const gram = {
  id: ids.g,
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  standardQuantity: null,
  standardUnitId: null,
};

const minimalRead = {
  id: ids.recipe,
  slug: "toast",
  name: "Toast",
  components: [{ id: ids.pasta }],
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
};

const fullRead: Recipe = {
  id: ids.recipe,
  slug: "spaghetti-al-burro",
  name: "Spaghetti al burro",
  description: "Butter and pasta.",
  image: "recipes/spaghetti-al-burro/original.webp",
  rating: 4.5,
  lastMade: "2026-09-01T09:00:00.000Z",
  recipeServings: 2,
  recipeYieldQuantity: 2,
  yieldUnit: { id: ids.serve, name: "serve", pluralName: "serves", abbreviation: "", useAbbreviation: false, fraction: true, standardQuantity: null, standardUnitId: null },
  recipeYield: "2 bowls",
  prepTime: 5,
  performTime: 12,
  sourceUrl: "https://example.com/burro",
  notes: [{ id: ids.note, title: "Tip", text: "Salt the water well." }],
  tags: [{ id: ids.tag, name: "Weeknight", slug: "weeknight" }],
  components: [
    {
      id: ids.sauce,
      name: "Sauce",
      ingredients: [
        {
          id: ids.ing1,
          quantity: 50,
          unit: gram,
          food: { id: ids.butter, name: "butter", pluralName: null, aliases: [], aisle: { id: ids.dairy, name: "Dairy", position: 3 }, recipeId: null, skipShopping: false },
          note: "cold, cubed",
          originalText: "50 g cold butter, cubed",
          fixed: false,
        },
        {
          id: ids.ing2,
          quantity: null,
          unit: null,
          food: { id: ids.salt, name: "salt", pluralName: null, aliases: ["sea salt"], aisle: null, recipeId: null, skipShopping: true },
          note: "to taste",
          originalText: "salt to taste",
          fixed: false,
        },
      ],
      steps: [{ id: ids.step1, text: "Melt the butter over low heat." }],
    },
    {
      id: ids.pasta,
      name: "Pasta",
      ingredients: [
        {
          id: ids.ing3,
          quantity: 200,
          unit: gram,
          food: { id: ids.spaghetti, name: "spaghetti", pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false },
          note: "",
          originalText: "=200 g spaghetti",
          fixed: true,
        },
      ],
      steps: [{ id: ids.step2, text: "Boil until al dente." }],
    },
  ],
  steps: [{ id: ids.step3, text: "Toss the pasta through the butter and serve." }],
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
};

describe("recipeSchema (read)", () => {
  test("minimal valid doc parses and fills defaults", () => {
    const doc = recipeSchema.parse(minimalRead);
    expect(doc.description).toBe("");
    expect(doc.rating).toBeNull();
    expect(doc.recipeServings).toBe(0);
    expect(doc.recipeYield).toBe("");
    expect(doc.prepTime).toBeNull();
    expect(doc.components).toEqual([{ id: ids.pasta, name: "", ingredients: [], steps: [] }]);
    expect(doc.steps).toEqual([]);
    expect(doc.notes).toEqual([]);
    expect(doc.tags).toEqual([]);
  });

  test("full doc round-trips unchanged", () => {
    expect(recipeSchema.parse(fullRead)).toEqual(fullRead);
  });

  test("read shape requires id, slug and timestamps", () => {
    const { id, slug, createdAt, updatedAt, ...rest } = fullRead;
    expect(recipeSchema.safeParse(rest).success).toBe(false);
    expect(recipeSchema.safeParse({ ...rest, id, slug, createdAt }).success).toBe(false);
    expect(recipeSchema.safeParse({ ...fullRead, id: "not-a-uuid" }).success).toBe(false);
  });
});

describe("recipeInputSchema (write)", () => {
  test("create needs only a name and one component", () => {
    const input: RecipeInput = { name: "Toast", components: [{}] };
    const parsed = recipeInputSchema.parse(input);
    expect(parsed.id).toBeUndefined();
    expect(parsed.components[0]).toEqual({ name: "", ingredients: [], steps: [] });
    expect("slug" in parsed).toBe(false);
  });

  test("accepts the full read document as a write", () => {
    const { slug, createdAt, updatedAt, ...writable } = fullRead;
    const parsed = recipeInputSchema.parse(fullRead);
    expect(parsed).toEqual(writable);
  });
});

describe("invalid documents", () => {
  test("no components", () => {
    const result = recipeSchema.safeParse({ ...fullRead, components: [] });
    expect(result.success).toBe(false);
    expect(recipeInputSchema.safeParse({ name: "Toast", components: [] }).success).toBe(false);
    expect(recipeInputSchema.safeParse({ name: "Toast" }).success).toBe(false);
  });

  test("negative quantity", () => {
    const bad = structuredClone(fullRead);
    bad.components[0]!.ingredients[0]!.quantity = -1;
    const result = recipeSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["components", 0, "ingredients", 0, "quantity"]);
    }
  });

  test("empty name", () => {
    expect(recipeSchema.safeParse({ ...fullRead, name: "" }).success).toBe(false);
    expect(recipeSchema.safeParse({ ...fullRead, name: "   " }).success).toBe(false);
    expect(recipeInputSchema.safeParse({ name: "", components: [{}] }).success).toBe(false);
  });

  test("rating outside 0..5 and non-integer minutes", () => {
    expect(recipeSchema.safeParse({ ...fullRead, rating: 6 }).success).toBe(false);
    expect(recipeSchema.safeParse({ ...fullRead, prepTime: 2.5 }).success).toBe(false);
  });
});
