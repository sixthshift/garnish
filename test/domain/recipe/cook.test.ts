import { describe, expect, test } from "vitest";
import {
  buildCookCards,
  cardAnnouncement,
  clampStep,
  isFinishedIndex,
  nextPreview,
  PREVIEW_MAX_CHARS,
  partPills,
  totalWithFinish,
} from "../../../src/domain/recipe/cook";
import type { Ingredient, Part, Step } from "../../../src/domain/recipe/recipe";
import { SWIPE_MAX_MS, SWIPE_MIN_PX, SWIPE_RATIO, swipeIntent } from "../../../src/lib/swipe";

const uuid = () => crypto.randomUUID();
const step = (text: string, ingredientIds: string[] = []): Step => ({ id: uuid(), text, title: "", summary: "", ingredientIds, image: null });
const ingredient = (note: string, fixed = false): Ingredient => ({ id: uuid(), quantity: 1, unit: null, food: null, note, originalText: "", fixed });
const part = (name: string, ingredients: Ingredient[], steps: Step[]): Part => ({ id: uuid(), name, ingredients, steps });

describe("buildCookCards", () => {
  test("three parts: each gives its ingredients then a card per step, the unnamed one last", () => {
    const pastry = part("Pastry", [ingredient("flour")], [step("Rub."), step("Chill.")]);
    const filling = part(" Filling ", [ingredient("lemon"), ingredient("vanilla", true)], [step("Whisk.")]);
    const assembly = part("", [], [step("Bake."), step("Cool.")]);
    const cards = buildCookCards({ parts: [pastry, filling, assembly] });

    expect(cards.map((c) => (c.kind === "ingredients" ? `${c.part}:ingredients` : `${c.part}:${c.step.text}`))).toEqual([
      "Pastry:ingredients",
      "Pastry:Rub.",
      "Pastry:Chill.",
      "Filling:ingredients",
      "Filling:Whisk.",
      ":Bake.",
      ":Cool.",
    ]);
    // Step numbering restarts per list and knows the list's length.
    expect(cards.filter((c) => c.kind === "step").map((c) => (c.kind === "step" ? `${c.number}/${c.total}` : ""))).toEqual(["1/2", "2/2", "1/1", "1/2", "2/2"]);
    // Ingredient cards carry the part's rows untouched, fixed flag included.
    const fillingCard = cards[3];
    expect(fillingCard?.kind).toBe("ingredients");
    if (fillingCard?.kind === "ingredients") expect(fillingCard.ingredients.map((i) => i.fixed)).toEqual([false, true]);
  });

  test("a single unnamed part labels its cards with an empty string", () => {
    const cards = buildCookCards({ parts: [part("", [ingredient("bread")], [step("Toast."), step("Butter.")])] });
    expect(cards.map((c) => c.part)).toEqual(["", "", ""]);
    expect(cards.map((c) => c.kind)).toEqual(["ingredients", "step", "step"]);
  });

  test("an empty part contributes no cards; a part with steps but no ingredients skips the ingredient card", () => {
    const empty = part("Garnish", [], []);
    const stepsOnly = part("Assembly", [], [step("Stack.")]);
    expect(buildCookCards({ parts: [empty] })).toEqual([]);
    const cards = buildCookCards({ parts: [empty, stepsOnly] });
    expect(cards.map((c) => [c.kind, c.part])).toEqual([["step", "Assembly"]]);
  });

  // M29.2: the ingredients card carries only the rows none of the part's steps
  // link — a linked row is read on its step card, resolved there from the
  // step card's own (full) `ingredients`.
  test("the ingredients card carries only the rows no step of the part links", () => {
    const flour = ingredient("flour");
    const butter = ingredient("butter");
    const pastry = part("Pastry", [flour, butter], [step("Rub the butter in.", [butter.id])]);

    const cards = buildCookCards({ parts: [pastry] });

    const ingredientsCard = cards.find((c) => c.kind === "ingredients");
    expect(ingredientsCard?.kind).toBe("ingredients");
    if (ingredientsCard?.kind === "ingredients") expect(ingredientsCard.ingredients).toEqual([flour]);
    // The step card still carries the part's full rows, so StepCard can resolve its own link.
    const stepCard = cards.find((c) => c.kind === "step");
    expect(stepCard?.kind).toBe("step");
    if (stepCard?.kind === "step") expect(stepCard.ingredients).toEqual([flour, butter]);
  });

  test("a part where every ingredient is linked from its steps has no ingredients card", () => {
    const butter = ingredient("butter");
    const pastry = part("Pastry", [butter], [step("Melt the butter.", [butter.id])]);

    const cards = buildCookCards({ parts: [pastry] });

    expect(cards.map((c) => c.kind)).toEqual(["step"]);
  });

  test("a part with no steps keeps all its rows on the ingredients card", () => {
    const flour = ingredient("flour");
    const garnish = part("Garnish", [flour], []);

    const cards = buildCookCards({ parts: [garnish] });

    expect(cards).toEqual([{ kind: "ingredients", part: "Garnish", ingredients: [flour] }]);
  });

  test("a row linked from one of several steps, and one linked from more than one, both drop off the ingredients card", () => {
    const flour = ingredient("flour");
    const butter = ingredient("butter");
    const salt = ingredient("salt");
    const pastry = part(
      "Pastry",
      [flour, butter, salt],
      [step("Rub the butter in.", [butter.id]), step("Add the salt.", [salt.id]), step("Add the butter again.", [butter.id])]
    );

    const cards = buildCookCards({ parts: [pastry] });
    const ingredientsCard = cards.find((c) => c.kind === "ingredients");
    expect(ingredientsCard?.kind).toBe("ingredients");
    if (ingredientsCard?.kind === "ingredients") expect(ingredientsCard.ingredients).toEqual([flour]);
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
  test("a step is counted within its list; an ingredient card names its part", () => {
    const cards = buildCookCards({
      parts: [part("Dough", [ingredient("flour")], [step("Knead."), step("Rest.")])],
    });
    expect(cardAnnouncement(cards[0]!)).toBe("Ingredients for Dough");
    expect(cardAnnouncement(cards[1]!)).toBe("Step 1 of 2");
    expect(cardAnnouncement(cards[2]!)).toBe("Step 2 of 2");
  });

  test("an unnamed part's ingredient card is just 'Ingredients'", () => {
    const cards = buildCookCards({ parts: [part("", [ingredient("bread")], [])] });
    expect(cardAnnouncement(cards[0]!)).toBe("Ingredients");
  });
});

describe("partPills", () => {
  test("one pill per part in deck order, each at that part's first card", () => {
    const cards = buildCookCards({
      parts: [part("Pastry", [ingredient("flour")], [step("Rub.")]), part("Filling", [], [step("Whisk."), step("Chill.")]), part("", [], [step("Bake.")])],
    });
    expect(partPills(cards)).toEqual([
      { name: "Pastry", label: "Pastry", index: 0 },
      { name: "Filling", label: "Filling", index: 2 },
      { name: "", label: "Recipe", index: 4 },
    ]);
  });

  test("the unnamed part reads 'Recipe', and a flat recipe is a single pill", () => {
    const cards = buildCookCards({ parts: [part("", [ingredient("bread")], [step("Toast."), step("Butter.")])] });
    expect(partPills(cards)).toEqual([{ name: "", label: "Recipe", index: 0 }]);
  });

  test("an empty deck has no pills", () => {
    expect(partPills([])).toEqual([]);
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

describe("nextPreview", () => {
  test("a middle step previews the next step's first line", () => {
    const cards = buildCookCards({ parts: [part("Pastry", [], [step("Rub the butter in."), step("Add the water.")])] });
    expect(nextPreview(cards, 0)).toBe("Add the water.");
  });

  test("a step right before an ingredients card previews that card's heading", () => {
    const cards = buildCookCards({
      parts: [part("Pastry", [], [step("Rub the butter in.")]), part("Filling", [ingredient("lemon")], [step("Whisk.")])],
    });
    expect(nextPreview(cards, 0)).toBe("Ingredients for Filling");
    // An ingredients card previews its own next card too (usually step 1).
    expect(nextPreview(cards, 1)).toBe("Whisk.");
  });

  test("an unnamed part's ingredients card previews plain 'Ingredients'", () => {
    const cards = buildCookCards({ parts: [part("Pastry", [], [step("Rub.")]), part("", [ingredient("bread")], [step("Toast.")])] });
    expect(nextPreview(cards, 0)).toBe("Ingredients");
  });

  test("the deck's last card previews 'Finished', same as an empty deck", () => {
    const cards = buildCookCards({ parts: [part("Pastry", [], [step("Rub."), step("Chill.")])] });
    expect(nextPreview(cards, cards.length - 1)).toBe("Finished");
    expect(nextPreview([], 0)).toBe("Finished");
  });

  test("list markers, emphasis and a leading blank line are stripped from the previewed line", () => {
    const cards = buildCookCards({ parts: [part("Pastry", [], [step("Rest."), step("\n  1. **Chill** the dough.")])] });
    expect(nextPreview(cards, 0)).toBe("Chill the dough.");
  });

  test("a long next line is cut with an ellipsis around 80 characters", () => {
    const long = "Whisk the eggs and sugar together until pale and thick, about five to seven minutes on high speed.";
    const cards = buildCookCards({ parts: [part("Filling", [], [step("Rest."), step(long)])] });
    const preview = nextPreview(cards, 0);
    expect(preview.length).toBeLessThanOrEqual(PREVIEW_MAX_CHARS);
    expect(preview.endsWith("…")).toBe(true);
    expect(long.startsWith(preview.slice(0, -1))).toBe(true);
  });
});
