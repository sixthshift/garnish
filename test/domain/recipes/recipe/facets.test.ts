import { expect, test } from "vitest";
import {
  FACET_LABELS,
  FACET_LAYERS,
  FACET_VALUES,
  facetLabel,
  facetsEmpty,
  facetsSchema,
  isBuildingBlock,
  noFacets,
} from "../../../../src/domain/recipes/recipe";

test("a layer's set comes out in the list's own order, each value once, and a missing layer is empty", () => {
  expect(facetsSchema.parse({ course: ["side", "main", "side"] })).toEqual({ ...noFacets(), course: ["main", "side"] });
});

test("a value not on its layer's list is refused", () => {
  expect(facetsSchema.safeParse({ cuisine: ["martian"] }).success).toBe(false);
  expect(facetsSchema.safeParse({ meal: ["main"] }).success).toBe(false);
});

test("every value of every layer has a label, and the labels say Starter, never entrée", () => {
  for (const layer of FACET_LAYERS) {
    for (const value of FACET_VALUES[layer]) expect(facetLabel(layer, value)).not.toBe(value);
  }
  expect(Object.values(FACET_LABELS.course).join(" ").toLowerCase()).not.toContain("entr");
});

test("a recipe is a building block only when every course it has is one", () => {
  expect(isBuildingBlock({ course: ["sauce"] })).toBe(true);
  expect(isBuildingBlock({ course: ["sauce", "condiment"] })).toBe(true);
  expect(isBuildingBlock({ course: ["sauce", "side"] })).toBe(false);
  expect(isBuildingBlock({ course: [] })).toBe(false);
});

test("facetsEmpty is true only with nothing said on any layer", () => {
  expect(facetsEmpty(noFacets())).toBe(true);
  expect(facetsEmpty({ ...noFacets(), season: ["winter"] })).toBe(false);
});
