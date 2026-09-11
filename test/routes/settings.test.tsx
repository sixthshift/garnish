// The Foods tab's pure helpers: aggregating usage across a multi-row delete,
// and the label shown for one row or several. The route's end-to-end
// rendering (tabs, the Foods table, its dialogs staying closed) lives in
// test/routes/loaders.test.tsx alongside the other routes.
import { describe, expect, test } from "vitest";
import { dedupeSummaries, foodsLabel, unitsLabel, type FoodRow } from "../../src/routes/settings";
import type { RecipeSummary, Unit } from "../../src/domain/recipe";

function summary(id: string, name: string): RecipeSummary {
  return {
    id,
    slug: name.toLowerCase(),
    name,
    image: null,
    rating: null,
    prepTime: null,
    performTime: null,
    totalTime: null,
    lastMade: null,
    favourite: false,
    tags: [],
  };
}

function food(id: string, name: string): FoodRow {
  return { id, name, pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false };
}

function unit(id: string, name: string): Unit {
  return { id, name, pluralName: null, abbreviation: "", useAbbreviation: false, fraction: true, standardQuantity: null, standardUnitId: null };
}

describe("dedupeSummaries", () => {
  test("keeps the first occurrence across several lists, dropping later duplicates", () => {
    const shortbread = summary("r1", "Shortbread");
    const toast = summary("r2", "Toast");
    expect(dedupeSummaries([[shortbread, toast], [toast], []])).toEqual([shortbread, toast]);
  });

  test("empty lists give an empty result", () => {
    expect(dedupeSummaries([[], []])).toEqual([]);
    expect(dedupeSummaries([])).toEqual([]);
  });
});

describe("foodsLabel", () => {
  test("names the single row, or counts several", () => {
    expect(foodsLabel([food("f1", "Butter")])).toBe("Butter");
    expect(foodsLabel([food("f1", "Butter"), food("f2", "Salt")])).toBe("2 foods");
  });
});

describe("unitsLabel", () => {
  test("names the single row, or counts several", () => {
    expect(unitsLabel([unit("u1", "gram")])).toBe("gram");
    expect(unitsLabel([unit("u1", "gram"), unit("u2", "cup")])).toBe("2 units");
  });
});
