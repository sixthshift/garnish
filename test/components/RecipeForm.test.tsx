// The recipe form's pure helpers, and the Check for M5.2: the default document
// the form submits (emptyDraft plus a name) saves and reads back with one
// component. The form's rendering is covered by the route tests in
// test/routes/loaders.test.tsx, which mount it with a router.
import { describe, expect, test } from "vitest";
import { draftFromRecipe, emptyDraft, parseAmount, parseMinutes, tagsFromNames, validateDraft } from "../../src/components/RecipeForm";
import { type Recipe, recipeInputSchema } from "../../src/domain/recipe";
import { createRecipe, getRecipe } from "../../src/server/recipes";
import { callServerFn, useTempDataDir } from "../helpers/server";

useTempDataDir();

const weeknight = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Weeknight", slug: "weeknight" };
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
  recipeServings: 4,
  recipeYieldQuantity: 1,
  yieldUnit: gram,
  recipeYield: "tart",
  prepTime: 20,
  performTime: 40,
  sourceUrl: null,
  notes: [{ id: "22222222-2222-4222-8222-222222222222", title: "Storage", text: "Two days." }],
  tags: [weeknight],
  components: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Pastry",
      ingredients: [{ id: "44444444-4444-4444-8444-444444444444", quantity: 200, unit: gram, food: null, note: "flour", originalText: "", fixed: false }],
      steps: [{ id: "55555555-5555-4555-8555-555555555555", text: "Rub in." }],
    },
  ],
  steps: [{ id: "66666666-6666-4666-8666-666666666666", text: "Bake." }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("emptyDraft", () => {
  test("is blank apart from one unnamed empty component, and fails validation only on the name", () => {
    const draft = emptyDraft();
    expect(draft.name).toBe("");
    expect(draft.components).toHaveLength(1);
    expect(draft.components[0]).toMatchObject({ name: "", ingredients: [], steps: [] });
    expect(draft.components[0]!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(draft.tags).toEqual([]);
    expect(draft.rating).toBeNull();
    expect(draft.id).toBeUndefined();
    const result = validateDraft(draft);
    expect(result).toEqual({ ok: false, errors: { name: "Name is required" } });
  });

  test("with a name it is a valid RecipeInput", () => {
    const result = validateDraft({ ...emptyDraft(), name: "Toast" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.components).toHaveLength(1);
  });

  test("returns a fresh object each time", () => {
    const a = emptyDraft();
    const b = emptyDraft();
    expect(a).not.toBe(b);
    expect(a.components).not.toBe(b.components);
  });
});

describe("draftFromRecipe", () => {
  test("drops slug and timestamps, keeps every other field and every id", () => {
    const draft = draftFromRecipe(stored);
    expect(draft).not.toHaveProperty("slug");
    expect(draft).not.toHaveProperty("createdAt");
    expect(draft).not.toHaveProperty("updatedAt");
    expect(draft.id).toBe(stored.id);
    expect(draft.name).toBe("Lemon tart");
    expect(draft.yieldUnit).toEqual(gram);
    expect(draft.tags).toEqual([weeknight]);
    expect(draft.components).toEqual(stored.components);
    expect(draft.steps).toEqual(stored.steps);
    expect(draft.notes).toEqual(stored.notes);
  });

  test("is a copy: editing the draft leaves the recipe alone", () => {
    const draft = draftFromRecipe(stored);
    draft.components[0]!.name = "Changed";
    draft.tags.push(weeknight);
    expect(stored.components[0]!.name).toBe("Pastry");
    expect(stored.tags).toHaveLength(1);
  });

  test("validates and parses back to the same document the server holds", () => {
    const result = validateDraft(draftFromRecipe(stored));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(recipeInputSchema.parse(stored));
  });
});

describe("validateDraft", () => {
  test("one message per failing field, keyed by path", () => {
    const result = validateDraft({ ...emptyDraft(), name: "   ", prepTime: 2.5, performTime: -1, recipeYieldQuantity: -2 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBe("Name is required");
    expect(result.errors.prepTime).toBe("Enter whole minutes");
    expect(result.errors.performTime).toBe("Minutes cannot be negative");
    expect(result.errors.recipeYieldQuantity).toBe("Yield cannot be negative");
    expect(Object.keys(result.errors).sort()).toEqual(["name", "performTime", "prepTime", "recipeYieldQuantity"]);
  });

  test("nested paths are dotted", () => {
    const result = validateDraft({ ...emptyDraft(), name: "Toast", components: [{ name: "", ingredients: [{ quantity: -1 }], steps: [] }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(["components.0.ingredients.0.quantity"]);
  });

  test("a valid draft returns the parsed document with defaults applied", () => {
    const result = validateDraft({ ...emptyDraft(), name: " Toast " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("Toast");
      expect(result.data.components[0]).toMatchObject({ name: "", ingredients: [], steps: [] });
    }
  });
});

describe("tagsFromNames", () => {
  test("reuses a known tag by name, case-insensitively, and invents a reference for a new one", () => {
    const tags = tagsFromNames(["weeknight", "Baking"], [weeknight]);
    expect(tags).toHaveLength(2);
    expect(tags[0]).toEqual(weeknight);
    expect(tags[1]!.name).toBe("Baking");
    expect(tags[1]!.slug).toBe("baking");
    expect(tags[1]!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test("trims, drops blanks and duplicates", () => {
    const tags = tagsFromNames([" Baking ", "", "baking", "  "], []);
    expect(tags.map((t) => t.name)).toEqual(["Baking"]);
  });

  test("a name with no slug characters still gets a non-empty slug", () => {
    expect(tagsFromNames(["!!!"], [])[0]!.slug).toBe("!!!");
  });

  test("every reference passes the tag schema inside a recipe document", () => {
    const result = validateDraft({ ...emptyDraft(), name: "Toast", tags: tagsFromNames(["Weeknight", "Crème brûlée"], []) });
    expect(result.ok).toBe(true);
  });
});

describe("parseAmount and parseMinutes", () => {
  test("parseAmount: blank or garbage is 0, otherwise the number", () => {
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("  ")).toBe(0);
    expect(parseAmount("abc")).toBe(0);
    expect(parseAmount("1.5")).toBe(1.5);
    expect(parseAmount("12")).toBe(12);
  });

  test("parseMinutes: blank or garbage is null, otherwise the number as typed", () => {
    expect(parseMinutes("")).toBeNull();
    expect(parseMinutes("x")).toBeNull();
    expect(parseMinutes("45")).toBe(45);
    expect(parseMinutes("2.5")).toBe(2.5); // left for zod to reject
  });
});

describe("Check: the form's default document round-trips", () => {
  test("emptyDraft plus a name creates a recipe with one component and reads back by slug", async () => {
    const created = await callServerFn(createRecipe, { ...emptyDraft(), name: "Toast" });
    expect(created.slug).toBe("toast");
    expect(created.components).toHaveLength(1);
    const fetched = await callServerFn(getRecipe, { slug: "toast" });
    expect(fetched).toEqual(created);
    expect(fetched.components[0]).toMatchObject({ name: "", ingredients: [], steps: [] });
    expect(fetched.tags).toEqual([]);
    expect(fetched.rating).toBeNull();
    // And the stored recipe becomes a draft that validates unchanged.
    const result = validateDraft(draftFromRecipe(fetched));
    expect(result.ok).toBe(true);
  });

  test("new tags typed by name are created on save", async () => {
    const created = await callServerFn(createRecipe, { ...emptyDraft(), name: "Toast", tags: tagsFromNames(["Breakfast"], []) });
    expect(created.tags).toHaveLength(1);
    expect(created.tags[0]).toMatchObject({ name: "Breakfast", slug: "breakfast" });
  });
});
