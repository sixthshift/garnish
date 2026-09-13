// The export's pure half (M34.1): the image file name becomes the URL that
// serves it, everything else about the document is left alone, and the
// download is named for the day it was taken.
import { expect, test } from "vitest";
import { EXPORT_VERSION, exportFileName, exportedRecipe, imageUrl } from "../../src/domain/export";
import type { Recipe } from "../../src/domain/recipe";

const recipe: Recipe = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "lemon-tart",
  name: "Lemon tart",
  description: "",
  image: "11111111-1111-4111-8111-111111111111.jpg",
  rating: null,
  lastMade: null,
  recipeServings: 8,
  recipeYieldQuantity: 0,
  yieldUnit: null,
  recipeYield: "",
  prepTime: null,
  performTime: null,
  sourceUrl: null,
  favourite: false,
  notes: [],
  tags: [],
  parts: [{ id: "22222222-2222-4222-8222-222222222222", name: "", ingredients: [], steps: [] }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test.each([
  ["a stored file name", "abc.jpg", "/api/images/abc.jpg"],
  ["null", null, null],
  ["an empty name", "", null],
  ["whitespace only", "   ", null],
])("imageUrl of %s", (_label, file, expected) => {
  expect(imageUrl(file)).toBe(expected);
});

test("exportedRecipe rewrites the image and nothing else", () => {
  const out = exportedRecipe(recipe);
  expect(out.image).toBe("/api/images/11111111-1111-4111-8111-111111111111.jpg");
  expect({ ...out, image: recipe.image }).toEqual(recipe);
  expect(recipe.image).toBe("11111111-1111-4111-8111-111111111111.jpg"); // the input is not mutated
});

test("a recipe with no image exports a null image", () => {
  expect(exportedRecipe({ ...recipe, image: null }).image).toBeNull();
});

test("exportFileName names the day, not the instant", () => {
  expect(exportFileName(new Date("2026-09-13T22:31:00.000Z"))).toBe("garnish-export-2026-09-13.json");
});

test("the envelope version is a number the reader can branch on", () => {
  expect(EXPORT_VERSION).toBe(1);
});
