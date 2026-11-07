// Which recipes a slot of the plan is filled from, by course and meal (decisions.md row 209).
import { describe, expect, test } from "vitest";
import { slotPool, suitsSlot } from "../../../../src/domain/plan/plan";
import type { Course, Facets, MealTime } from "../../../../src/domain/recipes/recipe";
import { noFacets } from "../../../../src/domain/recipes/recipe";

const said = (course: Course[], meal: MealTime[] = []): { facets: Facets } => ({ facets: { ...noFacets(), course, meal } });

describe("suitsSlot", () => {
  test.each<[string, Course[], boolean]>([
    ["no course said", [], true],
    ["a main", ["main"], true],
    ["a soup", ["soup"], true],
    ["a salad", ["salad"], true],
    ["a salad that is also a side", ["salad", "side"], true],
    ["a side", ["side"], false],
    ["a starter", ["starter"], false],
    ["a dessert", ["dessert"], false],
    ["baking", ["baking"], false],
    ["a snack", ["snack"], false],
    ["a drink", ["drink"], false],
    ["a sauce", ["sauce"], false],
    ["a condiment", ["condiment"], false],
    ["a spice mix", ["spice-mix"], false],
    ["a stock", ["stock"], false],
    ["a dough", ["dough"], false],
    ["a sauce and a stock", ["sauce", "stock"], false],
    ["a main that is also a sauce", ["main", "sauce"], true],
  ])("dinner: %s → %s", (_, course, expected) => {
    expect(suitsSlot(said(course), "dinner")).toBe(expected);
  });

  test("a dinner is decided by course alone: what meal is said does not narrow it", () => {
    expect(suitsSlot(said(["main"], ["lunch"]), "dinner")).toBe(true);
  });

  test.each<[string, Course[], MealTime[], "breakfast" | "lunch", boolean]>([
    ["nothing said", [], [], "breakfast", false],
    ["said to suit breakfast", [], ["breakfast"], "breakfast", true],
    ["said to suit lunch, asked breakfast", ["main"], ["lunch"], "breakfast", false],
    ["said to suit lunch and dinner", ["soup"], ["lunch", "dinner"], "lunch", true],
    ["a sauce said to suit breakfast", ["sauce"], ["breakfast"], "breakfast", false],
  ])("%s → %s", (_, course, meal, slot, expected) => {
    expect(suitsSlot(said(course, meal), slot)).toBe(expected);
  });
});

describe("slotPool", () => {
  const curry = { name: "Curry", ...said(["main"]) };
  const chutney = { name: "Chutney", ...said(["condiment"]) };
  const unmarked = { name: "Unmarked", ...said([]) };
  const porridge = { name: "Porridge", ...said([], ["breakfast"]) };

  test("a dinner keeps what can be one, in the order given", () => {
    expect(slotPool([chutney, unmarked, curry], "dinner").map((r) => r.name)).toEqual(["Unmarked", "Curry"]);
  });

  test("a breakfast prefers what is said to suit it", () => {
    expect(slotPool([curry, porridge, unmarked], "breakfast").map((r) => r.name)).toEqual(["Porridge"]);
  });

  test("a lunch nothing is said to suit falls back to everything but a building block", () => {
    expect(slotPool([curry, chutney, unmarked, porridge], "lunch").map((r) => r.name)).toEqual(["Curry", "Unmarked", "Porridge"]);
  });
});
