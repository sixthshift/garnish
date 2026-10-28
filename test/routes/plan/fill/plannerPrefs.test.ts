import { expect, test } from "vitest";
import {
  DEFAULT_SERVINGS,
  PLANNER_MEALS_KEY,
  PLANNER_SERVINGS_KEY,
  readOtherMeals,
  readServings,
  toggleMeal,
  writeOtherMeals,
  writeServings,
} from "../../../../src/routes/plan/fill/components/plannerPrefs";

function memory() {
  const map = new Map<string, string>();
  return { map, storage: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) } };
}

test("the meals besides dinner are read from what the Propose sheet stored, dinner and all", () => {
  const { map, storage } = memory();
  map.set(PLANNER_MEALS_KEY, JSON.stringify(["dinner", "lunch", "brunch"]));
  expect(readOtherMeals(storage)).toEqual(["lunch"]);
  writeOtherMeals(storage, ["breakfast"]);
  expect(JSON.parse(map.get(PLANNER_MEALS_KEY)!)).toEqual(["breakfast", "dinner"]);
  map.set(PLANNER_MEALS_KEY, "{");
  expect(readOtherMeals(storage)).toEqual([]);
  expect(readOtherMeals(undefined)).toEqual([]);
});

test("the head count is remembered, and falls back to four", () => {
  const { map, storage } = memory();
  expect(readServings(storage)).toBe(DEFAULT_SERVINGS);
  writeServings(storage, 6);
  expect(map.get(PLANNER_SERVINGS_KEY)).toBe("6");
  expect(readServings(storage)).toBe(6);
  map.set(PLANNER_SERVINGS_KEY, "-1");
  expect(readServings(storage)).toBe(DEFAULT_SERVINGS);
});

test("toggling a meal answers in the order a day eats", () => {
  expect(toggleMeal(["lunch"], "breakfast")).toEqual(["breakfast", "lunch"]);
  expect(toggleMeal(["breakfast", "lunch"], "lunch")).toEqual(["breakfast"]);
});
