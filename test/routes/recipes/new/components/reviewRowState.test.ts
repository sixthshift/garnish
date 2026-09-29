// The import review's rows at a glance: what each will become, the counts above the list, and the two decisions taken for every row at once.
import { describe, expect, test } from "vitest";
import type { Food as FoodRow } from "../../../../../src/db/models/food/repo";
import { reviewRows } from "../../../../../src/domain/ingredient";
import type { Unit } from "../../../../../src/domain/reference";
import { countsLine } from "../../../../../src/routes/recipes/new/components/IngredientReviewList";
import { createAllNew, leaveAllAsText, reviewCounts, rowState, rowSummary } from "../../../../../src/routes/recipes/new/components/reviewRowState";

const gram: Unit = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  standardQuantity: null,
  standardUnitId: null,
};
const flour: FoodRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "flour",
  pluralName: null,
  aliases: [],
  aisleId: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};

const rows = () => reviewRows(["200 g flour, sifted", "3 cloves garlic", "salt to taste"], { units: [gram], foods: [flour] });

describe("each row", () => {
  test("a matched food, an unknown one, and a line with nothing to read", () => {
    const [matched, unknown] = rows();
    expect(rowState(matched!)).toBe("matched");
    expect(rowSummary(matched!)).toMatchObject({ amount: "200 g", food: "flour", note: "sifted", label: "Matched" });
    expect(rowState(unknown!)).toBe("unknown");
    expect(rowSummary(unknown!)).toMatchObject({ food: "cloves garlic", label: "Unknown food" });
  });
});

describe("the list's decisions", () => {
  test("Create all new proposes every unknown food, and Leave all as text takes them back", () => {
    const created = createAllNew(rows());
    expect(created.filter((row) => rowState(row) === "create")).toHaveLength(2);
    expect(reviewCounts(created)).toEqual({ matched: 1, create: 2, unknown: 0, text: 0 });
    expect(countsLine(reviewCounts(created))).toBe("1 matched · 2 to create");
    const back = leaveAllAsText(created);
    expect(reviewCounts(back)).toEqual(reviewCounts(rows()));
    expect(countsLine(reviewCounts(back))).toBe("1 matched · 2 unknown");
  });

  test("a matched row is never touched by either", () => {
    expect(createAllNew(rows())[0]).toEqual(rows()[0]);
    expect(leaveAllAsText(rows())[0]).toEqual(rows()[0]);
  });
});
