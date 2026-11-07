import { expect, test } from "vitest";
import { hasMark, MARKING_OPTIONS, markingFromValue, markingValue, START_MARKING } from "../../../../../src/domain/recipes/components/facets/marking";
import { noFacets } from "../../../../../src/domain/recipes/recipe";

test("marking starts on the kind, as row 195 had it", () => {
  expect(START_MARKING).toEqual({ by: "kind" });
  expect(MARKING_OPTIONS[0]).toEqual({ value: "kind", label: "Rotation & Weekend" });
});

test("a marking round-trips through its select value, and a value off the lists is nothing", () => {
  const main = { by: "facet" as const, layer: "course" as const, value: "main" };
  expect(markingFromValue(markingValue(main))).toEqual(main);
  expect(markingFromValue("kind")).toEqual(START_MARKING);
  expect(markingFromValue("course:paleo")).toBeNull();
  expect(markingFromValue("colour:red")).toBeNull();
});

test("every value of every layer can be marked, named with its layer", () => {
  expect(MARKING_OPTIONS).toContainEqual({ value: "cuisine:sri-lankan", label: "Cuisine: Sri Lankan" });
  expect(MARKING_OPTIONS).toContainEqual({ value: "mainIngredient:legumes", label: "Main ingredient: Beans and lentils" });
});

test("hasMark says whether a recipe has the value", () => {
  expect(hasMark({ ...noFacets(), diet: ["vegan"] }, "diet", "vegan")).toBe(true);
  expect(hasMark(noFacets(), "diet", "vegan")).toBe(false);
});
