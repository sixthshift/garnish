// A varied week (decisions.md row 212): no main ingredient two nights running,
// no cuisine more than twice, the vegetarian nights spread through the week,
// each rule giving way, in that order of least to most important, only when
// the library cannot keep it.
import { expect, test } from "vitest";
import { CUISINE_CAP, isVegetarian, swapVaried, type VarietyRecipe, varyNights, vegetarianNightIndexes } from "../../../../src/domain/plan/plan";
import type { Facets } from "../../../../src/domain/recipes/recipe";

function recipe(id: string, facets: Partial<Pick<Facets, "mainIngredient" | "cuisine" | "diet">> = {}): VarietyRecipe {
  return { id, facets: { mainIngredient: [], cuisine: [], diet: [], ...facets } };
}

const byId = (recipes: VarietyRecipe[]) => new Map(recipes.map((r) => [r.id, r]));

test("an unmarked library fills in its own order, as before the rules", () => {
  const pool = ["a", "b", "c", "d", "e", "f"].map((id) => recipe(id));
  expect(varyNights(5, pool)).toEqual(["a", "b", "c", "d", "e"]);
  expect(varyNights(3, pool.slice(0, 2))).toEqual(["a", "b", null]);
});

test("no main ingredient two nights running: the next in line that differs is taken, and the skipped one comes back", () => {
  const pool = [
    recipe("chicken1", { mainIngredient: ["chicken"] }),
    recipe("chicken2", { mainIngredient: ["chicken"] }),
    recipe("beef", { mainIngredient: ["beef"] }),
    recipe("plain"),
  ];
  expect(varyNights(4, pool)).toEqual(["chicken1", "beef", "chicken2", "plain"]);
});

test("no cuisine more than twice in the week while another can be had", () => {
  expect(CUISINE_CAP).toBe(2);
  const pool = [
    recipe("it1", { cuisine: ["italian"] }),
    recipe("it2", { cuisine: ["italian"] }),
    recipe("it3", { cuisine: ["italian"] }),
    recipe("thai", { cuisine: ["thai"] }),
  ];
  expect(varyNights(3, pool)).toEqual(["it1", "it2", "thai"]);
});

test("the rules give way when the library cannot keep them: a night is only empty when nothing is left", () => {
  const pool = [
    recipe("c1", { mainIngredient: ["chicken"], cuisine: ["thai"] }),
    recipe("c2", { mainIngredient: ["chicken"], cuisine: ["thai"] }),
    recipe("c3", { mainIngredient: ["chicken"], cuisine: ["thai"] }),
  ];
  expect(varyNights(3, pool)).toEqual(["c1", "c2", "c3"]);
});

test("the vegetarian nights are spread through the week, and found further down the line when they must be", () => {
  expect([...vegetarianNightIndexes(5, 2)]).toEqual([1, 3]);
  expect([...vegetarianNightIndexes(5, 1)]).toEqual([2]);
  expect([...vegetarianNightIndexes(3, 5)]).toEqual([0, 1, 2]);
  const meat = ["m1", "m2", "m3", "m4", "m5"].map((id, i) => recipe(id, { mainIngredient: [i % 2 === 0 ? "beef" : "lamb"] }));
  const veg = [recipe("dal", { diet: ["vegan"], mainIngredient: ["legumes"] }), recipe("frittata", { diet: ["vegetarian"], mainIngredient: ["eggs"] })];
  const nights = varyNights(5, [...meat, ...veg], 2);
  expect(nights[1]).toBe("dal");
  expect(nights[3]).toBe("frittata");
  expect(nights.filter((id) => id === "dal" || id === "frittata")).toHaveLength(2);
});

test("a vegetarian night with no vegetarian recipe left is filled anyway", () => {
  const nights = varyNights(3, [recipe("a"), recipe("b"), recipe("c")], 2);
  expect(nights).toEqual(["a", "b", "c"]);
});

test("vegetarian means said vegetarian or vegan", () => {
  expect(isVegetarian(recipe("x", { diet: ["vegan"] }))).toBe(true);
  expect(isVegetarian(recipe("x", { diet: ["gluten-free"] }))).toBe(false);
});

test("Swap prefers the next recipe that shares no main ingredient with either neighbour", () => {
  const pool = [
    recipe("beef1", { mainIngredient: ["beef"] }),
    recipe("chicken", { mainIngredient: ["chicken"] }),
    recipe("beef2", { mainIngredient: ["beef"] }),
    recipe("fish", { mainIngredient: ["fish"] }),
    recipe("lamb", { mainIngredient: ["lamb"] }),
  ];
  // Night 1 sits between chicken and lamb... after the swap it is not chicken or lamb.
  const nights = ["chicken", "beef1", "lamb"];
  expect(swapVaried(nights, 1, pool, byId(pool))).toEqual(["chicken", "beef2", "lamb"]);
  const fishNeighbours = ["fish", "beef1", "lamb"];
  expect(swapVaried(fishNeighbours, 1, pool, byId(pool))).toEqual(["fish", "chicken", "lamb"]);
});

test("Swap keeps a vegetarian night vegetarian while the week needs it, and is unchanged with nothing else to give", () => {
  const pool = [recipe("dal", { diet: ["vegan"] }), recipe("steak", { mainIngredient: ["beef"] }), recipe("frittata", { diet: ["vegetarian"] })];
  expect(swapVaried(["steak", "dal"], 1, pool, byId(pool), 1)).toEqual(["steak", "frittata"]);
  expect(swapVaried(["steak", "dal"], 1, pool, byId(pool), 0)).toEqual(["steak", "frittata"]);
  expect(swapVaried(["a"], 0, [recipe("a")], byId([recipe("a")]))).toEqual(["a"]);
});
