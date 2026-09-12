// ingredientsInStep: which of a part's ingredients a step names. A table over
// the cases the matcher exists for — aliases, plurals, the substring trap
// ("brown sugar" must not also light up "sugar"), a step naming nothing, and a
// food named twice.
import { describe, expect, test } from "vitest";
import type { Food, Ingredient } from "../../src/domain/recipe";
import { foodNames, ingredientsInStep } from "../../src/domain/stepIngredients";

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(seq++).padStart(12, "0")}`;

function food(name: string, pluralName: string | null = null, aliases: string[] = []): Food {
  return { id: uuid(), name, pluralName, aliases, aisle: null, recipeId: null, skipShopping: false };
}

function ingredient(f: Food | null, originalText = ""): Ingredient {
  return {
    id: uuid(),
    quantity: null,
    unit: null,
    food: f,
    note: "",
    originalText,
    fixed: false,
  };
}

const flour = ingredient(food("flour"));
const egg = ingredient(food("egg", "eggs"));
const corianderLeaf = ingredient(food("coriander", null, ["cilantro", "chinese parsley"]));
const brownSugar = ingredient(food("brown sugar"));
const sugar = ingredient(food("sugar"));
const salt = ingredient(food("salt"));
const toTaste = ingredient(null, "a good pinch of pepper");

const part = [flour, egg, corianderLeaf, brownSugar, sugar, salt, toTaste];

describe("ingredientsInStep", () => {
  const cases: Array<[label: string, text: string, expected: Ingredient[]]> = [
    ["the plain name", "Sift the flour.", [flour]],
    ["the plural name", "Beat the eggs until pale.", [egg]],
    ["case is ignored", "FLOUR, then Salt.", [flour, salt]],
    ["an alias", "Chop the cilantro.", [corianderLeaf]],
    ["a multi-word alias", "Stir in the chinese parsley.", [corianderLeaf]],
    ["the longer name wins the substring", "Cream the butter with the brown sugar.", [brownSugar]],
    ["both when both are named", "Brown sugar first, then plain sugar.", [brownSugar, sugar]],
    ["a food named twice appears once", "Flour the bench, then dust more flour on top.", [flour]],
    ["name and plural together count once", "One egg now, the other eggs later.", [egg]],
    ["a step naming nothing", "Rest for ten minutes.", []],
    ["no partial word match", "Sprinkle over the saltbush and the flourish.", []],
    ["results follow list order, not text order", "Salt, eggs, flour.", [flour, egg, salt]],
    ["a text-only ingredient never matches", "Add a good pinch of pepper.", []],
    ["punctuation is a boundary", "Add flour; whisk.", [flour]],
    ["an empty step", "   ", []],
  ];

  for (const [label, text, expected] of cases) {
    test(label, () => {
      expect(ingredientsInStep(text, part).map((i) => i.id)).toEqual(expected.map((i) => i.id));
    });
  }

  test("an empty ingredient list matches nothing", () => {
    expect(ingredientsInStep("Sift the flour.", [])).toEqual([]);
  });

  test("the same food on two rows can both match", () => {
    const first = ingredient(food("butter"));
    const second = ingredient(food("butter"));
    // One occurrence is consumed by the first row; the second needs its own.
    expect(ingredientsInStep("Butter and more butter.", [first, second]).map((i) => i.id)).toEqual([first.id, second.id]);
  });
});

describe("foodNames", () => {
  test("name, plural and aliases, lowercased and de-duplicated", () => {
    expect(foodNames(food("Coriander", "Coriander", ["Cilantro", " ", "coriander"]))).toEqual(["coriander", "cilantro"]);
  });

  test("a food with only a name", () => {
    expect(foodNames(food("flour"))).toEqual(["flour"]);
  });
});
