// duplicateInput: the write document a "Duplicate" sends, derived from a
// stored recipe. Pure.
import { describe, expect, test } from "vitest";
import { copyName, duplicateInput } from "../../src/domain/duplicate";
import { recipeInputSchema, type Recipe } from "../../src/domain/recipe";

const id = () => crypto.randomUUID();

const tart: Recipe = {
  id: id(),
  slug: "lemon-tart",
  name: "Lemon tart",
  description: "Sharp.",
  image: "lemon-tart.jpg",
  rating: 4,
  lastMade: "2026-09-01T00:00:00.000Z",
  recipeServings: 8,
  recipeYieldQuantity: 1,
  yieldUnit: null,
  recipeYield: "1 tart",
  prepTime: 30,
  performTime: 45,
  sourceUrl: "https://example.test/tart",
  favourite: true,
  notes: [{ id: id(), title: "Tip", text: "Chill the pastry." }],
  tags: [{ id: id(), name: "Dessert", slug: "dessert" }],
  parts: [
    {
      id: id(),
      name: "Pastry",
      ingredients: [{ id: id(), quantity: 200, unit: null, food: null, note: "sifted", originalText: "200 g flour", fixed: true }],
      steps: [{ id: id(), text: "Rub in the butter." }],
    },
    { id: id(), name: "", ingredients: [], steps: [{ id: id(), text: "Serve cold." }] },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

describe("copyName", () => {
  test("appends the suffix", () => {
    expect(copyName("Lemon tart")).toBe("Lemon tart (copy)");
  });

  test("a copy of a copy says so again, as in Mealie", () => {
    expect(copyName("Lemon tart (copy)")).toBe("Lemon tart (copy) (copy)");
  });

  test("surrounding whitespace goes", () => {
    expect(copyName("  Lemon tart  ")).toBe("Lemon tart (copy)");
  });
});

describe("duplicateInput", () => {
  const copy = duplicateInput(tart);

  test("is a valid write document", () => {
    expect(recipeInputSchema.safeParse(copy).success).toBe(true);
  });

  test("takes the copy name and no id of its own", () => {
    expect(copy.name).toBe("Lemon tart (copy)");
    expect(copy.id).toBeUndefined();
  });

  test("drops every child id so the insert cannot collide", () => {
    expect(copy.notes?.every((note) => note.id === undefined)).toBe(true);
    expect(copy.parts.every((component) => component.id === undefined)).toBe(true);
    expect(copy.parts.flatMap((component) => component.ingredients ?? []).every((row) => row.id === undefined)).toBe(true);
    expect(copy.parts.flatMap((part) => part.steps ?? []).every((step) => step.id === undefined)).toBe(true);
  });

  test("resets what records what happened to the original", () => {
    expect(copy.lastMade).toBeNull();
    expect(copy.favourite).toBe(false);
  });

  test("keeps the content: times, yield, source, image, tags, notes, rows", () => {
    expect(copy).toMatchObject({
      description: "Sharp.",
      image: "lemon-tart.jpg",
      rating: 4,
      recipeServings: 8,
      recipeYield: "1 tart",
      prepTime: 30,
      performTime: 45,
      sourceUrl: "https://example.test/tart",
    });
    expect(copy.tags).toEqual(tart.tags);
    expect(copy.notes).toEqual([{ title: "Tip", text: "Chill the pastry." }]);
    expect(copy.parts[0]?.name).toBe("Pastry");
    expect(copy.parts[0]?.ingredients?.[0]).toMatchObject({ quantity: 200, note: "sifted", originalText: "200 g flour", fixed: true });
    expect(copy.parts[0]?.steps).toEqual([{ text: "Rub in the butter." }]);
    expect(copy.parts[1]?.steps).toEqual([{ text: "Serve cold." }]);
  });

  test("does not mutate the recipe it copies", () => {
    const before = JSON.stringify(tart);
    duplicateInput(tart);
    expect(JSON.stringify(tart)).toBe(before);
  });
});
