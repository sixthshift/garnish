import { expect, test } from "vitest";
import {
  countOf,
  facetFilterCount,
  facetSearch,
  facetsFromSearch,
  noFacetSearch,
  sameFacets,
  toggleFacet,
} from "../../../../../src/domain/recipes/components/facets/facetSearch";
import { noFacets } from "../../../../../src/domain/recipes/recipe";

test("the address's layers become facets, a value the lists do not hold dropped rather than failing", () => {
  expect(facetsFromSearch({ course: ["side", "main", "paleo"], cuisine: ["thai"] })).toEqual({ ...noFacets(), course: ["main", "side"], cuisine: ["thai"] });
  expect(facetsFromSearch({})).toEqual(noFacets());
});

test("facets become the address's params, an empty layer none at all", () => {
  expect(facetSearch({ ...noFacets(), diet: ["vegan"] })).toEqual({
    course: undefined,
    meal: undefined,
    cuisine: undefined,
    diet: ["vegan"],
    mainIngredient: undefined,
    method: undefined,
    season: undefined,
  });
  expect(Object.values(noFacetSearch()).every((value) => value === undefined)).toBe(true);
});

test("a toggle turns one value on or off and keeps the list's order", () => {
  const on = toggleFacet({ ...noFacets(), course: ["side"] }, "course", "main", true);
  expect(on.course).toEqual(["main", "side"]);
  expect(toggleFacet(on, "course", "side", false).course).toEqual(["main"]);
});

test("each value asked for is one filter", () => {
  expect(facetFilterCount({ ...noFacets(), course: ["main", "soup"], season: ["winter"] })).toBe(3);
});

test("two sets of facets are the same only when every layer says the same", () => {
  expect(sameFacets(noFacets(), noFacets())).toBe(true);
  expect(sameFacets({ ...noFacets(), meal: ["lunch"] }, noFacets())).toBe(false);
});

test("a count is the collection's for that value, 0 when no recipe has it", () => {
  const counts = [{ layer: "course" as const, value: "main", count: 4 }];
  expect(countOf(counts, "course", "main")).toBe(4);
  expect(countOf(counts, "course", "side")).toBe(0);
});
