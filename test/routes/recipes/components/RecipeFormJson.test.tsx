// The editor's JSON view (M13.5): the document round-trips through the
// textarea, and bad text comes back as a message rather than a draft.
import { describe, expect, test } from "vitest";
import { draftFromInput, draftFromRecipe, emptyDraft } from "../../../../src/domain/recipe/draft/draft";
import { draftFromJson, draftToJson } from "../../../../src/domain/recipe/draft/json";
import { type RecipeDraft } from "../../../../src/domain/recipe/draft/types";
import { type Recipe, recipeInputSchema } from "../../../../src/domain/recipe/recipe";

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

const stored: Recipe = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "lemon-tart",
  name: "Lemon tart",
  description: "Sharp.",
  image: "11111111-1111-4111-8111-111111111111.jpg",
  rating: 4,
  lastMade: null,
  favourite: true,
  recipeServings: 4,
  recipeYieldQuantity: 1,
  yieldUnit: gram,
  recipeYield: "tart",
  prepTime: 20,
  performTime: 40,
  sourceUrl: "https://example.com/tart",
  notes: [{ id: "22222222-2222-4222-8222-222222222222", title: "Storage", text: "Two days." }],
  tags: [{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Weeknight", slug: "weeknight" }],
  parts: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Pastry",
      ingredients: [{ id: "44444444-4444-4444-8444-444444444444", quantity: 200, unit: gram, food: null, note: "flour", originalText: "200 g flour", fixed: true }],
      steps: [{ id: "55555555-5555-4555-8555-555555555555", text: "Rub in.", ingredientIds: [], image: null }],
    },
    {
      id: "77777777-7777-4777-8777-777777777777",
      name: "",
      ingredients: [],
      steps: [{ id: "66666666-6666-4666-8666-666666666666", text: "Bake.", ingredientIds: [], image: null }],
    },
  ],
  restyledAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("draftToJson", () => {
  test("is the draft indented, and parses back as a recipe input", () => {
    const draft = draftFromRecipe(stored);
    const text = draftToJson(draft);
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain('"name": "Lemon tart"');
    expect(JSON.parse(text)).toEqual(draft);
    expect(recipeInputSchema.safeParse(JSON.parse(text)).success).toBe(true);
  });

  test("does not carry the recipe's slug or timestamps (a tag keeps its own slug)", () => {
    const text = draftToJson(draftFromRecipe(stored));
    expect(text).not.toContain('"lemon-tart"');
    expect(text).toContain('"slug": "weeknight"');
    expect(text).not.toContain('"createdAt"');
    expect(text).not.toContain('"updatedAt"');
  });
});

describe("draftFromJson", () => {
  test("round-trips a full draft unchanged", () => {
    const draft = draftFromRecipe(stored);
    const result = draftFromJson(draftToJson(draft));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft).toEqual(draft);
  });

  test("round-trips the blank draft", () => {
    const draft: RecipeDraft = { ...emptyDraft(), name: "Toast" };
    const result = draftFromJson(draftToJson(draft));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft).toEqual(draft);
  });

  test("fills in the defaults and ids a hand-written document leaves out", () => {
    const result = draftFromJson('{"name":"Toast","parts":[{"name":"","ingredients":[{"note":"bread"}],"steps":[{"text":"Toast it."}]}]}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.description).toBe("");
    expect(result.draft.recipeServings).toBe(0);
    expect(result.draft.tags).toEqual([]);
    expect(result.draft.parts[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.draft.parts[0]?.ingredients[0]).toMatchObject({ note: "bread", quantity: null, fixed: false });
    expect(result.draft.parts[0]?.steps[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("reports a syntax error", () => {
    const result = draftFromJson("{ nope");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/^That is not valid JSON: /);
  });

  test("reports the failing field paths", () => {
    const result = draftFromJson('{"name":"","parts":[]}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("name:");
    expect(result.error).toContain("parts:");
    expect(result.error).toContain("a recipe needs at least one part");
  });

  test("rejects a document that is not an object", () => {
    for (const text of ["[]", '"a recipe"', "null", "7"]) {
      const result = draftFromJson(text);
      expect(result.ok).toBe(false);
    }
  });
});

describe("draftFromInput", () => {
  test("keeps the ids a parsed document already carries", () => {
    const parsed = recipeInputSchema.parse(JSON.parse(draftToJson(draftFromRecipe(stored))));
    const draft = draftFromInput(parsed);
    expect(draft.id).toBe(stored.id);
    expect(draft.parts[0]?.id).toBe(stored.parts[0]?.id);
    expect(draft.parts[0]?.ingredients[0]?.id).toBe(stored.parts[0]?.ingredients[0]?.id);
    expect(draft.parts[1]?.steps[0]?.id).toBe(stored.parts[1]?.steps[0]?.id);
    expect(draft.notes[0]?.id).toBe(stored.notes[0]?.id);
  });
});
