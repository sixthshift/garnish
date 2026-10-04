// The Style space's model: where a step starts, where a finding is shown, and what is saved from a mix of rewritten and original steps.
import { describe, expect, test } from "vitest";
import { checkRestyle, type OriginalPart, type RestyledPart } from "../../../../../src/domain/style";
import {
  assemble,
  changesAnything,
  checkChoices,
  choiceCounts,
  choosePart,
  initialChoices,
  isAligned,
  partFindings,
  type StyleAnswer,
  type StyleChoices,
  stepDroppedWords,
  stepKey,
  styleOriginal,
  takesRewrite,
} from "../../../../../src/routes/recipes/components/style/styleSession";
import { restyledPart, restyledStep } from "../../../../helpers/restyle";

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

describe("where a finding is shown", () => {
  test("a lost condition sits on the author's step that said it", () => {
    const answer = answerFor(droppingCondition());
    const findings = partFindings(original()[0]!, answer.check.parts[0]!, true);
    expect(findings.part).toEqual([]);
    expect(findings.steps.map((list) => list.map((finding) => finding.item))).toEqual([[], ["until fragrant"], []]);
    expect(findings.steps[1]![0]!.message).toBe("“until fragrant” is in the original but not in the rewrite.");
  });

  test("in a part chosen whole there is no step to put it on, so the part holds it", () => {
    const answer = answerFor(droppingCondition());
    const findings = partFindings(original()[0]!, answer.check.parts[0]!, false);
    expect(findings.part.map((finding) => finding.item)).toEqual(["until fragrant"]);
  });

  test("an invented condition sits on the step whose rewrite says it", () => {
    const [first] = droppingCondition();
    const parts = [
      {
        ...first!,
        steps: [
          first!.steps[0]!,
          restyledStep("Add the garlic and cook for a minute or two until fragrant."),
          restyledStep("Add the peanuts and toss until glossy, then serve."),
        ],
      },
    ];
    const answer = answerFor(parts);
    const findings = partFindings(original()[0]!, answer.check.parts[0]!, true, parts[0]);
    expect(findings.steps.map((list) => list.map((finding) => finding.kind))).toEqual([[], [], ["added"]]);
    expect(findings.steps[2]![0]!.message).toBe("The rewrite adds “until glossy, then serve”, which the recipe never says.");
  });

  test("dropped words are placed on the step that used them", () => {
    const answer = answerFor(droppingCondition());
    expect(stepDroppedWords(original()[0]!, answer.check.parts[0]!)[2]).toContain("finally");
  });
});

describe("where each step starts", () => {
  test("on the rewrite, except a step with a finding, which starts on the author's words", () => {
    const choices = initialChoices(original(), answerFor(droppingCondition()));
    expect([0, 1, 2].map((s) => choices.steps[stepKey(0, s)])).toEqual(["rewrite", "original", "rewrite"]);
  });

  test("a rewrite that merged steps is chosen whole, and a whole-part finding starts it on the original", () => {
    const merged: RestyledPart[] = [
      { name: "", notes: ["smashed and sliced"], steps: [restyledStep("Heat 2 tbsp oil over high heat, add the garlic and peanuts, and serve.")] },
    ];
    const answer = answerFor(merged);
    expect(isAligned(original()[0]!, merged[0]!)).toBe(false);
    expect(initialChoices(original(), answer).parts[0]).toBe("original");
  });
});

describe("what is saved", () => {
  test("each step the side chosen for it, with a retyped rewrite in place of the model's", () => {
    const answer = answerFor(droppingCondition());
    const choices: StyleChoices = { ...initialChoices(original(), answer), edits: { [stepKey(0, 0)]: "Heat 2 tbsp of the oil in the wok until smoking." } };
    const [part] = assemble(original(), answer, choices);
    expect(part!.steps.map((step) => step.text)).toEqual([
      "Heat 2 tbsp of the oil in the wok until smoking.",
      "Add the garlic and cook for a minute or two until fragrant.",
      "Add the peanuts and serve.",
    ]);
    expect(part!.steps[0]!.title).toBe("Sear");
  });

  test("a part's notes are the rewrite's while any of its rewrite is taken, and the author's once none is", () => {
    const rewrite = droppingCondition();
    rewrite[0]!.notes = ["smashed, then sliced"];
    const answer = answerFor(rewrite);
    const some = initialChoices(original(), answer);
    expect(assemble(original(), answer, some)[0]!.notes).toEqual(["smashed, then sliced"]);
    const none = choosePart(some, original(), answer, 0, "original");
    expect(assemble(original(), answer, none)[0]!.notes).toEqual(["smashed and sliced"]);
    expect(changesAnything(original(), assemble(original(), answer, none))).toBe(false);
  });

  test("keeping the flagged rewrite anyway is caught again by the check over what is saved", () => {
    const answer = answerFor(droppingCondition());
    const all = choosePart(initialChoices(original(), answer), original(), answer, 0, "rewrite");
    expect(takesRewrite(all, original(), answer, 0, 1)).toBe(true);
    expect(checkChoices(original(), assemble(original(), answer, all)).missingConditions).toEqual(["until fragrant"]);
    // The starting choices keep the author's step, so nothing is lost.
    expect(checkChoices(original(), assemble(original(), answer, initialChoices(original(), answer))).ok).toBe(true);
  });

  test("a mix can lose a sentence the rewrite moved between steps, which neither step's own finding shows", () => {
    const from = styleOriginal([{ name: "", ingredients: [], steps: [{ text: "Stir the sauce until thick." }, { text: "Serve." }] }]);
    // The rewrite moves the condition from step one into step two's supporting line: the whole part keeps it.
    const moved: RestyledPart[] = [
      { name: "", notes: [], steps: [restyledStep("Stir the sauce."), restyledStep("Serve.", { summary: "Stir until thick first." })] },
    ];
    const answer = answerFor(moved, from);
    expect(answer.check.ok).toBe(true);
    // Taking the first rewrite but the second original loses it.
    const mixed: StyleChoices = { steps: { [stepKey(0, 0)]: "rewrite", [stepKey(0, 1)]: "original" }, parts: { 0: "rewrite" }, edits: {} };
    expect(checkChoices(from, assemble(from, answer, mixed)).missingConditions).toEqual(["until thick"]);
  });
});

describe("the counts", () => {
  test("choices, rewrites kept and findings, leaving out a step the rewrite did not change", () => {
    const rewrite = droppingCondition();
    rewrite[0] = { ...rewrite[0]!, steps: [...rewrite[0]!.steps.slice(0, 2), restyledStep("Finally, add the peanuts and serve.")] };
    const answer = answerFor(rewrite);
    expect(choiceCounts(original(), answer, initialChoices(original(), answer))).toEqual({ total: 2, kept: 1, flagged: 1 });
  });

  test("a part with no steps is not a choice", () => {
    const from = styleOriginal([{ name: "To serve", ingredients: [], steps: [] }]);
    const answer = answerFor([restyledPart("To serve", [])], from);
    expect(choiceCounts(from, answer, initialChoices(from, answer))).toEqual({ total: 0, kept: 0, flagged: 0 });
  });
});
