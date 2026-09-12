import { describe, expect, test } from "vitest";
import { headingSection, looksLikeIngredient, splitRecipe, stepRows, stripMarker } from "../../src/domain/splitRecipe";

describe("stripMarker", () => {
  test.each([
    ["- 2 eggs", "2 eggs"],
    ["* 2 eggs", "2 eggs"],
    ["• 2 eggs", "2 eggs"],
    ["1. Preheat the oven.", "Preheat the oven."],
    ["2) Melt the butter.", "Melt the butter."],
    ["Step 3: Fold it through.", "Fold it through."],
    ["  125 g butter  ", "125 g butter"],
  ])("%s -> %s", (line, expected) => {
    expect(stripMarker(line)).toBe(expected);
  });

  test("leaves an amount that is not a marker alone", () => {
    // "2 eggs" must not lose its "2": the marker needs punctuation after it.
    expect(stripMarker("2 eggs")).toBe("2 eggs");
    expect(stripMarker("1 cup plain flour")).toBe("1 cup plain flour");
  });
});

describe("headingSection", () => {
  test.each([
    ["Ingredients", "ingredients"],
    ["ingredients:", "ingredients"],
    ["**Ingredients**", "ingredients"],
    ["## Ingredients for the pastry", "ingredients"],
    ["You will need", "ingredients"],
    ["Method", "steps"],
    ["Instructions:", "steps"],
    ["Directions", "steps"],
    ["Steps", "steps"],
  ])("%s -> %s", (line, expected) => {
    expect(headingSection(line)).toBe(expected);
  });

  test.each(["Add the ingredients", "2 eggs", "", "Anzac biscuits", "Preheat the oven."])("%s is not a heading", (line) => {
    expect(headingSection(line)).toBeNull();
  });
});

describe("looksLikeIngredient", () => {
  test.each(["1 cup plain flour", "125 g butter", "2 eggs", "½ bunch coriander, chopped", "salt and pepper", "olive oil"])("%s reads as an ingredient", (line) => {
    expect(looksLikeIngredient(line)).toBe(true);
  });

  test.each([
    "Whisk everything together until smooth.",
    "Preheat the oven to 200°C.",
    "Melt the butter with the golden syrup in a small saucepan over low heat",
    "",
  ])("%s does not", (line) => {
    expect(looksLikeIngredient(line)).toBe(false);
  });
});

describe("stepRows", () => {
  test("one step per line when no blank line separates them", () => {
    expect(stepRows(["1. Beat the eggs.", "2. Cook them."])).toEqual(["Beat the eggs.", "Cook them."]);
  });

  test("one step per paragraph when blank lines do", () => {
    expect(stepRows(["Preheat the oven. Line a tray", "and set it aside.", "", "Melt the butter."])).toEqual([
      "Preheat the oven. Line a tray and set it aside.",
      "Melt the butter.",
    ]);
  });

  test("blank only is no steps", () => {
    expect(stepRows(["", "  ", ""])).toEqual([]);
  });
});

describe("splitRecipe", () => {
  test("a headed paste splits on its headings", () => {
    const result = splitRecipe(`Anzac biscuits

Ingredients
1 cup plain flour
1 cup rolled oats
125 g butter

Method
1. Preheat the oven to 180°C.
2. Melt the butter.`);
    expect(result).toEqual({
      title: "Anzac biscuits",
      ingredients: ["1 cup plain flour", "1 cup rolled oats", "125 g butter"],
      steps: ["Preheat the oven to 180°C.", "Melt the butter."],
    });
  });

  test("a list that only labels its method keeps the lines above as ingredients", () => {
    const result = splitRecipe(`2 eggs
300 ml milk

Instructions
Whisk them together.`);
    expect(result.ingredients).toEqual(["2 eggs", "300 ml milk"]);
    expect(result.steps).toEqual(["Whisk them together."]);
    expect(result.title).toBeNull();
  });

  test("an unheaded paste splits on the shape of its lines", () => {
    const result = splitRecipe(`Pancakes
1 cup plain flour
2 eggs
300 ml milk
Whisk everything together until smooth.
Fry in a hot pan until golden.`);
    expect(result).toEqual({
      title: "Pancakes",
      ingredients: ["1 cup plain flour", "2 eggs", "300 ml milk"],
      steps: ["Whisk everything together until smooth.", "Fry in a hot pan until golden."],
    });
  });

  test("bullets are stripped from both lists", () => {
    const result = splitRecipe(`- 2 eggs
- 1 cup milk

- Whisk the eggs.
- Add the milk and whisk again.`);
    expect(result.ingredients).toEqual(["2 eggs", "1 cup milk"]);
    expect(result.steps).toEqual(["Whisk the eggs.", "Add the milk and whisk again."]);
  });

  test("ingredients only leaves no steps", () => {
    const result = splitRecipe("2 eggs\n1 cup milk\n");
    expect(result.ingredients).toEqual(["2 eggs", "1 cup milk"]);
    expect(result.steps).toEqual([]);
  });

  test("prose only leaves no ingredients", () => {
    const result = splitRecipe(`Preheat the oven to 200°C. Roast the chicken for an hour.

Rest it for ten minutes before carving.`);
    expect(result.title).toBeNull();
    expect(result.ingredients).toEqual([]);
    expect(result.steps).toEqual(["Preheat the oven to 200°C. Roast the chicken for an hour.", "Rest it for ten minutes before carving."]);
  });

  test("a blank paste is empty", () => {
    expect(splitRecipe("")).toEqual({ title: null, ingredients: [], steps: [] });
    expect(splitRecipe("   \n\n  ")).toEqual({ title: null, ingredients: [], steps: [] });
  });

  test("a single line is a row, not a title", () => {
    expect(splitRecipe("2 eggs")).toEqual({ title: null, ingredients: ["2 eggs"], steps: [] });
  });

  test("a wrapped method becomes one step per paragraph", () => {
    const result = splitRecipe(`Method
Preheat the oven. Line a tray with baking paper and set it
aside until needed.

Melt the butter with the golden syrup.`);
    expect(result.steps).toEqual([
      "Preheat the oven. Line a tray with baking paper and set it aside until needed.",
      "Melt the butter with the golden syrup.",
    ]);
  });
});
