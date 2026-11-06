// A recipe card's ingredient groups (decisions.md row 204): WP Recipe Maker's
// markup read, laid over the JSON-LD's lines by count and checked by name, and
// a main body's steps placed in the parts whose ingredients they name. The
// pages are trimmed to the shapes four sites drew on 2026-11-06.
import { describe, expect, test } from "vitest";
import { shouldReadWithModel } from "../../../../../src/domain/recipes/components/new/importSummary";
import { extractRecipe } from "../../../../../src/domain/recipes/import/extract";
import { ingredientGroups } from "../../../../../src/domain/recipes/import/page/recipeCard";
import { placeSteps } from "../../../../../src/domain/recipes/import/placeSteps";
import type { FoodRow, Unit } from "../../../../../src/domain/recipes/reference";

type Group = { name?: string; heading?: "h4" | "h5"; items: { amount: string; name: string }[] };

/** A recipe card the way WP Recipe Maker draws one, checkbox and screen-reader clutter included. */
function card(groups: Group[]): string {
  const body = groups
    .map((group) => {
      const tag = group.heading ?? "h4";
      const heading =
        group.name === undefined ? "" : `<${tag} class="wprm-recipe-group-name wprm-recipe-ingredient-group-name wprm-block-text-bold">${group.name}</${tag}>`;
      const items = group.items
        .map(
          (item, i) =>
            `<li class="wprm-recipe-ingredient" style="list-style-type: none;" data-uid="${i}"><span class="wprm-checkbox-container"><input type="checkbox" class="wprm-checkbox" aria-label="&nbsp;${item.amount} ${item.name}"><label class="wprm-checkbox-label"><span class="sr-only">&#9634; </span></label></span><span class="wprm-recipe-ingredient-amount">${item.amount}</span>&#32;<span class="wprm-recipe-ingredient-name">${item.name}</span></li>`
        )
        .join("");
      return `<div class="wprm-recipe-ingredient-group">${heading}<ul class="wprm-recipe-ingredients">${items}</ul></div>`;
    })
    .join("");
  return `<div class="wprm-recipe-ingredients-container wprm-block-text-normal" data-recipe="1"><h3 class="wprm-recipe-header">Ingredients</h3>${body}</div>`;
}

/** A page: the JSON-LD, then the card (or cards). */
function page(recipe: { ingredients: string[]; instructions: unknown[] }, ...cards: string[]): string {
  const node = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: "A recipe",
    recipeIngredient: recipe.ingredients,
    recipeInstructions: recipe.instructions,
  };
  return `<html><head><script type="application/ld+json">${JSON.stringify(node)}</script></head><body><div class="wprm-recipe-container">${cards.join("")}</div></body></html>`;
}

const step = (text: string) => ({ "@type": "HowToStep", text });
const section = (name: string, ...texts: string[]) => ({ "@type": "HowToSection", name, itemListElement: texts.map(step) });

const food = (id: string, name: string, pluralName: string | null = null): FoodRow => ({
  id,
  name,
  pluralName,
  aliases: [],
  aisleId: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
});
const teaspoon: Unit = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "teaspoon",
  pluralName: "teaspoons",
  abbreviation: "tsp",
  useAbbreviation: true,
  fraction: true,
  portion: false,
  standardQuantity: null,
  standardUnitId: null,
};
const vocabulary = {
  units: [teaspoon],
  foods: [food("1", "smoked paprika"), food("2", "garlic powder"), food("3", "chicken"), food("4", "pasta"), food("5", "cream cheese"), food("6", "rice")],
};

// Budget Bytes: named groups, the steps all in one list.
const budgetBytes = page(
  {
    ingredients: ["2 tsp smoked paprika", "1 tsp garlic powder", "1 lb chicken", "8 oz pasta", "2 oz cream cheese"],
    instructions: [
      step("Combine the ingredients for the Cajun seasoning."),
      step("Brown the chicken in the skillet."),
      step("Add the pasta and simmer for 12 minutes."),
      step("Stir in the cream cheese."),
      step("Serve hot."),
    ],
  },
  card([
    {
      name: "Cajun Seasoning",
      items: [
        { amount: "2 tsp", name: "smoked paprika" },
        { amount: "1 tsp", name: "garlic powder" },
      ],
    },
    {
      name: "Chicken Pasta",
      items: [
        { amount: "1 lb", name: "chicken" },
        { amount: "8 oz", name: "pasta" },
        { amount: "2 oz", name: "cream cheese" },
      ],
    },
  ])
);

describe("ingredientGroups", () => {
  test("reads each group's heading and its lines' food names, in order", () => {
    expect(ingredientGroups(budgetBytes)).toEqual([
      { name: "Cajun Seasoning", foods: ["smoked paprika", "garlic powder"] },
      { name: "Chicken Pasta", foods: ["chicken", "pasta", "cream cheese"] },
    ]);
  });

  test("a first group with no heading is the main body", () => {
    const html = card([{ items: [{ amount: "3", name: "chicken breasts" }] }, { name: "Masala Sauce:", items: [{ amount: "1 tbsp", name: "oil" }] }]);
    expect(ingredientGroups(html)).toEqual([
      { name: "", foods: ["chicken breasts"] },
      { name: "Masala Sauce:", foods: ["oil"] },
    ]);
  });

  test("only the first card is read, and a page with none has no groups", () => {
    const second = card([{ name: "Another recipe", items: [{ amount: "1", name: "egg" }] }]);
    expect(ingredientGroups(`${budgetBytes}${second}`)?.map((group) => group.name)).toEqual(["Cajun Seasoning", "Chicken Pasta"]);
    expect(ingredientGroups("<html><body><ul><li>1 egg</li></ul></body></html>")).toBeNull();
  });
});

describe("extractRecipe with a recipe card", () => {
  test("the card's groups become parts, the steps left for placing", () => {
    const found = extractRecipe(budgetBytes, "https://example.test/")!;
    expect(found.partsFromPage).toBe("ingredients");
    expect(found.recipe.parts.map((part) => [part.name, part.ingredients.length, part.steps.length])).toEqual([
      ["", 0, 5],
      ["Cajun Seasoning", 2, 0],
      ["Chicken Pasta", 3, 0],
    ]);
  });

  test("a heading's colon is tidied away, as any part name's is", () => {
    const html = page(
      { ingredients: ["1 tsp oil", "12 oz chicken"], instructions: [step("Cook.")] },
      card([
        { name: "To roast the peanuts:", heading: "h5", items: [{ amount: "1 tsp", name: "oil" }] },
        { name: "To marinate the chicken:", heading: "h5", items: [{ amount: "12 oz", name: "chicken" }] },
      ])
    );
    expect(extractRecipe(html, "https://example.test/")!.recipe.parts.map((part) => part.name)).toEqual([
      "",
      "To roast the peanuts",
      "To marinate the chicken",
    ]);
  });

  test("groups whose names the step sections share place everything, and the model is not asked", () => {
    const html = page(
      {
        ingredients: ["2 tsp smoked paprika", "1 lb chicken"],
        instructions: [section("Cajun Seasoning", "Mix the spices."), section("Chicken", "Brown the chicken.")],
      },
      card([
        { name: "Cajun seasoning", items: [{ amount: "2 tsp", name: "smoked paprika" }] },
        { name: "Chicken", items: [{ amount: "1 lb", name: "chicken" }] },
      ])
    );
    const found = extractRecipe(html, "https://example.test/")!;
    expect(found.partsFromPage).toBe("complete");
    expect(found.recipe.parts.map((part) => [part.name, part.ingredients, part.steps])).toEqual([
      ["Cajun seasoning", ["2 tsp smoked paprika"], ["Mix the spices."]],
      ["Chicken", ["1 lb chicken"], ["Brown the chicken."]],
    ]);
    expect(shouldReadWithModel(found, true)).toBe(false);
  });

  test("step sections named otherwise stay their own parts, and the model still sorts (RecipeTin Eats' chasseur)", () => {
    const html = page(
      { ingredients: ["4 chicken thighs", "400 g mushrooms"], instructions: [section("Chicken", "Brown it."), section("Chasseur Sauce", "Make it.")] },
      card([{ items: [{ amount: "4", name: "chicken thighs" }] }, { name: "Sauce Chasseur", items: [{ amount: "400 g", name: "mushrooms" }] }])
    );
    const found = extractRecipe(html, "https://example.test/")!;
    expect(found.partsFromPage).toBe("ingredients");
    expect(found.recipe.parts.map((part) => part.name)).toEqual(["", "Sauce Chasseur", "Chicken", "Chasseur Sauce"]);
    expect(shouldReadWithModel(found, true)).toBe(true);
    expect(placeSteps(found.recipe, vocabulary).settled).toBe(false);
  });

  test("a card that does not agree with the JSON-LD is left out: another count, or another food", () => {
    const short = page(
      { ingredients: ["2 tsp smoked paprika", "1 lb chicken", "salt"], instructions: [step("Cook.")] },
      card([
        { name: "Spice", items: [{ amount: "2 tsp", name: "smoked paprika" }] },
        { name: "Main", items: [{ amount: "1 lb", name: "chicken" }] },
      ])
    );
    const other = page(
      { ingredients: ["2 tsp smoked paprika", "1 lb beef"], instructions: [step("Cook.")] },
      card([
        { name: "Spice", items: [{ amount: "2 tsp", name: "smoked paprika" }] },
        { name: "Main", items: [{ amount: "1 lb", name: "chicken" }] },
      ])
    );
    for (const html of [short, other]) {
      const found = extractRecipe(html, "https://example.test/")!;
      expect(found.partsFromPage).toBeUndefined();
      expect(found.recipe.parts.map((part) => part.name)).toEqual([""]);
    }
  });
});

describe("placeSteps", () => {
  const found = extractRecipe(budgetBytes, "https://example.test/")!;
  const placed = placeSteps(found.recipe, vocabulary);

  test("each step goes to the part whose ingredients it names, or that it names itself", () => {
    expect(placed.recipe.parts.map((part) => [part.name, part.steps])).toEqual([
      ["Cajun Seasoning", ["Combine the ingredients for the Cajun seasoning."]],
      ["Chicken Pasta", ["Brown the chicken in the skillet.", "Add the pasta and simmer for 12 minutes.", "Stir in the cream cheese.", "Serve hot."]],
    ]);
    // A step naming no food ("Serve hot.") follows the one before it; every step found a home.
    expect(placed.settled).toBe(true);
  });

  test("every line and step is still there: the sort moves, it never adds or drops", () => {
    const lines = (recipe: typeof found.recipe) => recipe.parts.flatMap((part) => part.ingredients).sort();
    const steps = (recipe: typeof found.recipe) => recipe.parts.flatMap((part) => part.steps).sort();
    expect(lines(placed.recipe)).toEqual(lines(found.recipe));
    expect(steps(placed.recipe)).toEqual(steps(found.recipe));
  });

  test("a step naming two parts' ingredients equally stays put, and the read is not settled", () => {
    const html = page(
      { ingredients: ["2 tsp smoked paprika", "1 lb chicken"], instructions: [step("Rub the smoked paprika into the chicken.")] },
      card([
        { name: "Spice mix", items: [{ amount: "2 tsp", name: "smoked paprika" }] },
        { name: "Bird", items: [{ amount: "1 lb", name: "chicken" }] },
      ])
    );
    const tied = placeSteps(extractRecipe(html, "https://example.test/")!.recipe, vocabulary);
    expect(tied.settled).toBe(false);
  });
});
