// The Style space's model: what the check found, where the choice starts, and what is saved of the version chosen.
import { describe, expect, test } from "vitest";
import {
  answerFindings,
  assemble,
  changesAnything,
  checkChoices,
  initialChoices,
  isRebuilt,
  type StyleAnswer,
  type StyleChoices,
  stepKey,
  styleOriginal,
} from "../../../../../src/domain/recipes/components/style/styleSession";
import { checkRestyle, type OriginalPart, type RestyledPart } from "../../../../../src/domain/recipes/style";
import { restyledStep } from "../../../../helpers/restyle";

const garlic = {
  quantity: 3,
  unit: null,
  food: { name: "garlic", pluralName: null },
  note: "smashed and sliced",
  originalText: "3 cloves garlic",
  fixed: false,
};

/** The Kung Pao method's last part, cut down: three steps, one of them with a condition to lose. */
function original(): OriginalPart[] {
  return styleOriginal([
    {
      name: "",
      ingredients: [garlic],
      steps: [
        { text: "Heat 2 tablespoons oil in a wok over high heat." },
        { text: "Add the garlic and cook for a minute or two until fragrant." },
        { text: "Finally, add the peanuts and serve." },
      ],
    },
  ]);
}

/** A rewrite of `original()` that drops "until fragrant" from the second step and rewords the other two. */
function droppingCondition(): RestyledPart[] {
  return [
    {
      name: "",
      rows: [0],
      notes: ["smashed and sliced"],
      steps: [
        restyledStep("Heat 2 tbsp of the oil in a wok over high heat.", { title: "Sear" }),
        restyledStep("Add the garlic and cook for 1 or 2 minutes."),
        restyledStep("Add the peanuts and serve."),
      ],
    },
  ];
}

function answerFor(parts: RestyledPart[], from = original()): StyleAnswer {
  return { parts, check: checkRestyle(from, parts) };
}

describe("what the check found", () => {
  test("a lost phrase and an invented one, each worded for the house style's version", () => {
    expect(answerFindings(original(), answerFor(droppingCondition())).map((finding) => finding.message)).toEqual([
      "“until fragrant” is in the original but not in the rewrite.",
    ]);
    const [first] = droppingCondition();
    const inventing = [
      {
        ...first!,
        steps: [
          first!.steps[0]!,
          restyledStep("Add the garlic and cook for a minute or two until fragrant."),
          restyledStep("Add the peanuts and toss until glossy, then serve."),
        ],
      },
    ];
    expect(answerFindings(original(), answerFor(inventing)).map((finding) => finding.message)).toEqual([
      "The rewrite adds “until glossy, then serve”, which the recipe never says.",
    ]);
  });

  test("nothing when the check passed", () => {
    const [first] = droppingCondition();
    const parts = [{ ...first!, steps: [first!.steps[0]!, restyledStep("Add the garlic and cook for a minute or two until fragrant."), first!.steps[2]!] }];
    expect(answerFindings(original(), answerFor(parts))).toEqual([]);
  });
});

describe("where the choice starts", () => {
  test("on the house style, even when the check found something: a finding is shown, never chosen for the household", () => {
    expect(initialChoices()).toEqual({ recipe: "rewrite", edits: {} });
  });
});

describe("what is saved", () => {
  test("the rewrite, with a retyped step in place of the model's, and its notes", () => {
    const rewrite = droppingCondition();
    rewrite[0]!.notes = ["smashed, then sliced"];
    const answer = answerFor(rewrite);
    const choices: StyleChoices = { ...initialChoices(), edits: { [stepKey(0, 0)]: "Heat 2 tbsp of the oil in the wok until smoking." } };
    const [part] = assemble(original(), answer, choices);
    expect(part!.steps.map((step) => step.text)).toEqual([
      "Heat 2 tbsp of the oil in the wok until smoking.",
      "Add the garlic and cook for 1 or 2 minutes.",
      "Add the peanuts and serve.",
    ]);
    expect(part!.steps[0]!.title).toBe("Sear");
    expect(part!.notes).toEqual(["smashed, then sliced"]);
  });

  test("the author's recipe as written, which changes nothing", () => {
    const answer = answerFor(droppingCondition());
    const back = assemble(original(), answer, { ...initialChoices(), recipe: "original" });
    expect(back[0]!.notes).toEqual(["smashed and sliced"]);
    expect(changesAnything(original(), back)).toBe(false);
  });

  test("a part the rewrite gave no steps keeps the author's", () => {
    const rewrite = droppingCondition();
    rewrite[0]!.steps = [];
    const [part] = assemble(original(), answerFor(rewrite), initialChoices());
    expect(part!.steps.map((step) => step.text)).toEqual(original()[0]!.steps.map((step) => step.text));
  });

  test("the check over what is saved catches a flagged rewrite, and a retyped step that puts the phrase back clears it", () => {
    const answer = answerFor(droppingCondition());
    expect(checkChoices(original(), assemble(original(), answer, initialChoices())).missingConditions).toEqual(["until fragrant"]);
    const fixed: StyleChoices = { ...initialChoices(), edits: { [stepKey(0, 1)]: "Add the garlic and cook for 1 or 2 minutes, until fragrant." } };
    expect(checkChoices(original(), assemble(original(), answer, fixed)).ok).toBe(true);
  });
});

describe("a rewrite that lays the recipe out afresh", () => {
  /** `original()` with the garlic moved into a new "To serve" part, with the last step. */
  function rebuilt(): RestyledPart[] {
    const [first] = droppingCondition();
    return [
      { name: "", rows: [], notes: [], steps: [first!.steps[0]!, restyledStep("Add the garlic and cook for a minute or two until fragrant.")] },
      { name: "To serve", rows: [0], notes: ["sliced"], steps: [restyledStep("Add the peanuts and serve.")] },
    ];
  }

  test("has its findings over the whole recipe", () => {
    const answer = answerFor(rebuilt());
    expect(isRebuilt(original(), answer)).toBe(true);
    expect(answerFindings(original(), answer)).toEqual([]);

    const losing = rebuilt();
    losing[0]!.steps = [losing[0]!.steps[0]!, restyledStep("Add the garlic and cook for 1 or 2 minutes.")];
    expect(answerFindings(original(), answerFor(losing)).map((finding) => finding.item)).toEqual(["until fragrant"]);
  });

  test("saves the rewrite's layout with any retyped step, or the author's recipe as written", () => {
    const answer = answerFor(rebuilt());
    const choices: StyleChoices = { ...initialChoices(), edits: { [stepKey(1, 0)]: "Toss in the peanuts and serve." } };
    const saved = assemble(original(), answer, choices);
    expect(saved.map((part) => [part.name, part.rows, part.notes])).toEqual([
      ["", [], []],
      ["To serve", [0], ["sliced"]],
    ]);
    expect(saved[1]!.steps[0]!.text).toBe("Toss in the peanuts and serve.");
    expect(changesAnything(original(), saved)).toBe(true);

    const back = assemble(original(), answer, { ...choices, recipe: "original" });
    expect(back).toEqual([
      { name: "", rows: [0], notes: ["smashed and sliced"], steps: original()[0]!.steps.map((step) => ({ title: "", summary: "", ...step })) },
    ]);
    expect(changesAnything(original(), back)).toBe(false);
  });
});
