// What reads wrong in a rewrite though nothing was lost, each from the Chicken & Soft Tofu Casserole's first rewrite.
import { describe, expect, test } from "vitest";
import {
  idleSteps,
  imperialMeasures,
  noteFragments,
  otherKitchenWords,
  readingIssues,
  repeatedRuns,
  sortingHeadings,
} from "../../../../src/domain/recipes/style/readability";
import type { OriginalPart, RestyledPart } from "../../../../src/domain/recipes/style/restyleCheck";
import { restyledStep } from "../../../helpers/restyle";

const water = { food: { name: "water", pluralName: null }, originalText: "2 cups water, hot, to soak the mushrooms", note: "hot" };
const mushrooms = { food: { name: "dried shiitake mushroom", pluralName: "dried shiitake mushrooms" }, originalText: "4 dried shiitake mushrooms", note: "" };

const original: OriginalPart[] = [
  {
    name: "",
    ingredients: [mushrooms, water],
    steps: [
      { text: "Rinse the dried shiitake mushrooms and soak them in 2 cups of hot water for at least 2 hours." },
      { text: "Cut the block of tofu into 19 mm cubes. Lay the cubes on a large plate, and set aside while you prepare the other ingredients." },
    ],
  },
];

function rewrite(steps: RestyledPart["steps"], notes = ["", "hot"]): RestyledPart[] {
  return [{ name: "", rows: [0, 1], notes, steps }];
}

describe("an instruction said twice", () => {
  test("in a step and its own supporting line is found once", () => {
    const parts = rewrite([
      restyledStep("- Soak the dried shiitake mushrooms in the hot water for at least 2 hours.", {
        summary: "Start first: soak the dried shiitake mushrooms in the hot water, at least 2 hours.",
      }),
    ]);
    expect(repeatedRuns(original, parts)).toEqual(["soak the dried shiitake mushrooms in the"]);
  });

  test("is not found in a supporting line that gives another way of doing the step, which repeats it on purpose", () => {
    const parts = rewrite([
      restyledStep("Top with the green parts of the spring onion, cover and simmer over medium heat, 8 minutes.", {
        summary: "Alternatively, keep it in the wok, top with the green parts of the spring onion, cover and simmer over medium heat, 8 minutes.",
      }),
    ]);
    expect(repeatedRuns(original, parts)).toEqual([]);
  });

  test("is not found where the author already said it twice, or where only a few words are shared", () => {
    const twice: OriginalPart[] = [
      { ...original[0]!, steps: [{ text: "Stir in the sauce and bring to a simmer." }, { text: "Stir in the sauce and bring to a simmer again." }] },
    ];
    expect(
      repeatedRuns(twice, rewrite([restyledStep("Stir in the sauce and bring to a simmer."), restyledStep("Stir in the sauce and bring to a simmer again.")]))
    ).toEqual([]);
    expect(repeatedRuns(original, rewrite([restyledStep("Add the garlic and stir."), restyledStep("Add the garlic and ginger.")]))).toEqual([]);
  });
});

test("a step that only sets something aside is a step with nothing to do, unless it waits for a time or a cue", () => {
  const parts = rewrite([
    restyledStep("Set the tofu aside while preparing the other ingredients."),
    restyledStep("Set the dough aside to rest for 30 minutes."),
    restyledStep("Leave it to stand until bubbly."),
  ]);
  expect(idleSteps(parts)).toEqual(["Set the tofu aside while preparing the other ingredients."]);
});

test("an ingredient's short note pasted in after its food reads as a fragment", () => {
  const parts = rewrite([restyledStep("Soak the dried shiitake mushrooms in the water, hot.")]);
  expect(noteFragments(original, parts)).toEqual(["water, hot"]);
  expect(noteFragments(original, rewrite([restyledStep("Soak them in the water, hot, for at least 2 hours.")], ["", "hot, to soak the mushrooms"]))).toEqual([
    "water, hot",
  ]);
  expect(noteFragments(original, rewrite([restyledStep("Soak the dried shiitake mushrooms in the hot water.")]))).toEqual([]);
});

test("an imperial measure left in a step or a note, but not a cup or a spoon", () => {
  const parts = rewrite(
    [
      restyledStep("Transfer to a clay pot or small 2-qt. Dutch oven."),
      restyledStep("Bake at 350°F."),
      restyledStep("Add 2 cups of the water and 1 tbsp of the oil."),
    ],
    ["sliced into 2-inch lengths", "hot"]
  );
  expect(imperialMeasures(parts)).toEqual(["2-qt.", "350°F", "2-inch"]);
});

test("a word from another kitchen, with the household's word for it", () => {
  const parts = rewrite([restyledStep("Add the white parts of the scallions to the skillet."), restyledStep("Preheat the oven.")]);
  expect(otherKitchenWords(parts)).toEqual([
    { word: "skillet", ours: "frying pan" },
    { word: "Preheat", ours: "heat" },
    { word: "scallions", ours: "spring onion" },
  ]);
});

test("every issue is worded for the household, and a clean rewrite has none", () => {
  const messy = rewrite([
    restyledStep("Soak the dried shiitake mushrooms in the water, hot."),
    restyledStep("Set the tofu aside while preparing the other ingredients."),
  ]);
  expect(readingIssues(original, messy).map((issue) => issue.message)).toEqual([
    "“Set the tofu aside while preparing the other ingredients.” is a step with nothing to do.",
    "“water, hot” reads as a list note pasted into a sentence.",
  ]);
  const clean = rewrite([
    restyledStep("Soak the dried shiitake mushrooms in the hot water, at least 2 hours."),
    restyledStep("Cut the tofu into 19 mm cubes and lay them on a large plate."),
  ]);
  expect(readingIssues(original, clean)).toEqual([]);
});

test("a part named for how the list was sorted, not for what it makes", () => {
  const parts: RestyledPart[] = ["For the chicken and marinade", "For the rest of the dish", "Choose one", "Sauce", "", "To serve", "Fortune cookies"].map(
    (name) => ({
      name,
      rows: [],
      notes: [],
      steps: [],
    })
  );
  expect(sortingHeadings(parts)).toEqual(["For the chicken and marinade", "For the rest of the dish", "Choose one"]);
});
