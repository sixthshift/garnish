import { describe, expect, test } from "vitest";
import {
  buildCookCards,
  cardAnnouncement,
  clampStep,
  componentPills,
  finishLabel,
  isFinishedIndex,
  SWIPE_MAX_MS,
  SWIPE_MIN_PX,
  SWIPE_RATIO,
  swipeIntent,
  totalWithFinish,
} from "../../src/domain/cook";
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

describe("totalWithFinish", () => {
  test("one more than the card count for a non-empty deck; 0 for an empty one", () => {
    expect(totalWithFinish(5)).toBe(6);
    expect(totalWithFinish(1)).toBe(2);
    expect(totalWithFinish(0)).toBe(0);
  });
});

describe("isFinishedIndex", () => {
  test("true only just past the last card of a non-empty deck", () => {
    expect(isFinishedIndex(5, 5)).toBe(true);
    expect(isFinishedIndex(4, 5)).toBe(false);
    expect(isFinishedIndex(6, 5)).toBe(false);
    expect(isFinishedIndex(0, 0)).toBe(false);
  });
});

describe("cardAnnouncement", () => {
  test("a step is counted within its list; an ingredient card names its component", () => {
    const cards = buildCookCards({
      components: [component("Dough", [ingredient("flour")], [step("Knead."), step("Rest.")])],
      steps: [],
    });
    expect(cardAnnouncement(cards[0]!)).toBe("Ingredients for Dough");
    expect(cardAnnouncement(cards[1]!)).toBe("Step 1 of 2");
    expect(cardAnnouncement(cards[2]!)).toBe("Step 2 of 2");
  });

  test("an unnamed component's ingredient card is just 'Ingredients'", () => {
    const cards = buildCookCards({ components: [component("", [ingredient("bread")], [])], steps: [] });
    expect(cardAnnouncement(cards[0]!)).toBe("Ingredients");
  });
});

describe("componentPills", () => {
  test("one pill per component in deck order, each at that component's first card", () => {
    const cards = buildCookCards({
      components: [component("Pastry", [ingredient("flour")], [step("Rub.")]), component("Filling", [], [step("Whisk."), step("Chill.")])],
      steps: [step("Bake.")],
    });
    expect(componentPills(cards)).toEqual([
      { name: "Pastry", label: "Pastry", index: 0 },
      { name: "Filling", label: "Filling", index: 2 },
      { name: "To finish", label: "To finish", index: 4 },
    ]);
  });

  test("the unnamed section reads 'Recipe', and a flat recipe is a single pill", () => {
    const cards = buildCookCards({ components: [component("", [ingredient("bread")], [step("Toast.")])], steps: [step("Butter.")] });
    expect(componentPills(cards)).toEqual([{ name: "", label: "Recipe", index: 0 }]);
  });

  test("an empty deck has no pills", () => {
    expect(componentPills([])).toEqual([]);
  });
});

describe("swipeIntent", () => {
  test("a flick up brings the next card on, a flick down the previous", () => {
    expect(swipeIntent({ dx: 0, dy: -120, ms: 200 })).toBe("next");
    expect(swipeIntent({ dx: 0, dy: 120, ms: 200 })).toBe("prev");
    // Exactly at the distance threshold still counts.
    expect(swipeIntent({ dx: 0, dy: -SWIPE_MIN_PX, ms: 100 })).toBe("next");
  });

  test("a short drag is a scroll or a tap, not a swipe", () => {
    expect(swipeIntent({ dx: 0, dy: -(SWIPE_MIN_PX - 1), ms: 100 })).toBeNull();
    expect(swipeIntent({ dx: 0, dy: 0, ms: 40 })).toBeNull();
  });

  test("a sideways drag is not vertical enough", () => {
    expect(swipeIntent({ dx: 200, dy: -80, ms: 200 })).toBeNull();
    expect(swipeIntent({ dx: -200, dy: 80, ms: 200 })).toBeNull();
    // Vertical travel must beat horizontal by the ratio, not merely equal it.
    expect(swipeIntent({ dx: 80, dy: -80, ms: 200 })).toBeNull();
    expect(swipeIntent({ dx: 80, dy: -(80 * SWIPE_RATIO), ms: 200 })).toBe("next");
  });

  test("a slow drag is a scroll however far it went", () => {
    expect(swipeIntent({ dx: 0, dy: -300, ms: SWIPE_MAX_MS + 1 })).toBeNull();
    expect(swipeIntent({ dx: 0, dy: -300, ms: SWIPE_MAX_MS })).toBe("next");
  });

  test("nonsense numbers are ignored rather than moving the deck", () => {
    expect(swipeIntent({ dx: Number.NaN, dy: -120, ms: 200 })).toBeNull();
    expect(swipeIntent({ dx: 0, dy: Number.NEGATIVE_INFINITY, ms: 200 })).toBeNull();
    expect(swipeIntent({ dx: 0, dy: -120, ms: -5 })).toBeNull();
  });
});
