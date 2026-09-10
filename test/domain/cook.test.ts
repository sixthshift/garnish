import { describe, expect, test } from "vitest";
import { buildCookCards, clampStep, finishLabel } from "../../src/domain/cook";
import type { Component, Ingredient, Step } from "../../src/domain/recipe";

const uuid = () => crypto.randomUUID();
const step = (text: string): Step => ({ id: uuid(), text });
const ingredient = (note: string, fixed = false): Ingredient => ({ id: uuid(), quantity: 1, unit: null, food: null, note, originalText: "", fixed });
const component = (name: string, ingredients: Ingredient[], steps: Step[]): Component => ({ id: uuid(), name, ingredients, steps });

describe("buildCookCards", () => {
  test("two components: each gives its ingredients then a card per step, then the recipe-level steps as 'To finish'", () => {
    const pastry = component("Pastry", [ingredient("flour")], [step("Rub."), step("Chill.")]);
    const filling = component(" Filling ", [ingredient("lemon"), ingredient("vanilla", true)], [step("Whisk.")]);
    const cards = buildCookCards({ components: [pastry, filling], steps: [step("Bake."), step("Cool.")] });

    expect(cards.map((c) => (c.kind === "ingredients" ? `${c.component}:ingredients` : `${c.component}:${c.step.text}`))).toEqual([
      "Pastry:ingredients",
      "Pastry:Rub.",
      "Pastry:Chill.",
      "Filling:ingredients",
      "Filling:Whisk.",
      "To finish:Bake.",
      "To finish:Cool.",
    ]);
    // Step numbering restarts per list and knows the list's length.
    expect(cards.filter((c) => c.kind === "step").map((c) => (c.kind === "step" ? `${c.number}/${c.total}` : ""))).toEqual([
      "1/2",
      "2/2",
      "1/1",
      "1/2",
      "2/2",
    ]);
    // Ingredient cards carry the component's rows untouched, fixed flag included.
    const fillingCard = cards[3];
    expect(fillingCard?.kind).toBe("ingredients");
    if (fillingCard?.kind === "ingredients") expect(fillingCard.ingredients.map((i) => i.fixed)).toEqual([false, true]);
  });

  test("a single unnamed component labels its cards and the recipe-level steps with an empty string", () => {
    const cards = buildCookCards({ components: [component("", [ingredient("bread")], [step("Toast.")])], steps: [step("Butter.")] });
    expect(cards.map((c) => c.component)).toEqual(["", "", ""]);
    expect(cards.map((c) => c.kind)).toEqual(["ingredients", "step", "step"]);
  });

  test("an empty component contributes no cards; a component with steps but no ingredients skips the ingredient card", () => {
    const empty = component("Garnish", [], []);
    const stepsOnly = component("Assembly", [], [step("Stack.")]);
    expect(buildCookCards({ components: [empty], steps: [] })).toEqual([]);
    const cards = buildCookCards({ components: [empty, stepsOnly], steps: [] });
    expect(cards.map((c) => [c.kind, c.component])).toEqual([["step", "Assembly"]]);
  });
});

describe("finishLabel", () => {
  test("names the recipe-level steps only when there is more than one component", () => {
    expect(finishLabel({ components: [component("", [], [])] })).toBe("");
    expect(finishLabel({ components: [component("A", [], []), component("B", [], [])] })).toBe("To finish");
  });
});

describe("clampStep", () => {
  test.each([
    [0, 5, 0],
    [4, 5, 4],
    [5, 5, 4],
    [99, 5, 4],
    [-3, 5, 0],
    [2.7, 5, 2],
    [3, 0, 0],
  ])("clampStep(%s, %s) -> %s", (step, count, expected) => {
    expect(clampStep(step, count)).toBe(expected);
  });
});
