// ingredientsInStep: which of a part's ingredients a step names. A table over
// the cases the matcher exists for — aliases, plurals, the substring trap
// ("brown sugar" must not also light up "sugar"), a step naming nothing, and a
// food named twice.
import { describe, expect, test } from "vitest";
import type { Ingredient, Step } from "../../../src/domain/recipe/recipe";
import { foodNames, ingredientsInStep, suggestLinks } from "../../../src/domain/recipe/stepIngredients";
import type { Food } from "../../../src/domain/reference";

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(seq++).padStart(12, "0")}`;

function food(name: string, pluralName: string | null = null, aliases: string[] = []): Food {
  return { id: uuid(), name, pluralName, aliases, aisle: null, recipeId: null, skipShopping: false, conversions: [] };
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

function step(text: string, ingredientIds: string[] = []): Pick<Step, "id" | "text" | "ingredientIds"> {
  return { id: uuid(), text, ingredientIds };
}

describe("suggestLinks", () => {
  test("a step naming two rows links both, in list order", () => {
    const [linked] = suggestLinks({ ingredients: part, steps: [step("Add flour and salt.")] });
    expect(linked!.ingredientIds).toEqual([flour.id, salt.id]);
  });

  test("a row named in two steps is linked from both", () => {
    const [first, second] = suggestLinks({
      ingredients: part,
      steps: [step("Beat the eggs."), step("Fold in the eggs.")],
    });
    expect(first!.ingredientIds).toEqual([egg.id]);
    expect(second!.ingredientIds).toEqual([egg.id]);
  });

  test("a step that already has a link is left untouched", () => {
    const already = step("Add the flour.", [salt.id]);
    const [result] = suggestLinks({ ingredients: part, steps: [already] });
    expect(result).toBe(already);
    expect(result!.ingredientIds).toEqual([salt.id]);
  });

  test("a step naming nothing stays empty", () => {
    const [result] = suggestLinks({ ingredients: part, steps: [step("Rest for ten minutes.")] });
    expect(result!.ingredientIds).toEqual([]);
  });

  test("a food that exists only in another part is not linked", () => {
    // Butter is a row of some other part; this part's own ingredient list
    // (`part`, above) has no such row, so naming it here finds nothing.
    const [result] = suggestLinks({ ingredients: part, steps: [step("Melt the butter.")] });
    expect(result!.ingredientIds).toEqual([]);
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
