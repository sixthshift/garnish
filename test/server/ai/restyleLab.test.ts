// The restyle lab's pure half: flags, the recipe rebuilt from the author's parts, and the report. The CLI itself is one wiring block and is not run here.
import { describe, expect, test } from "vitest";
import type { Recipe } from "../../../src/domain/recipes/recipe";
import { failureLine, rulesFromText } from "../../../src/server/ai/lab";
import type { RestyleResult } from "../../../src/server/ai/restyle";
import { authorRecipe, LAB_USAGE, onlyPart, parseLabFlags, reportLines } from "../../../src/server/ai/restyleLab";
import { restyledPart } from "../../helpers/restyle";

const step = (id: string, text: string) => ({ id, text, ingredientIds: [], image: null });
const row = (id: string, note = "") => ({ id, quantity: null, unit: null, food: null, note, originalText: id, fixed: false, alternatives: [] });
const recipe = {
  name: "Ragu",
  parts: [
    { id: "p0", name: "", ingredients: [], steps: [] },
    { id: "p1", name: "Full recipe", ingredients: [row("i1", "patted dry")], steps: [step("s1", "Pat beef dry."), step("s2", "Sear beef.")] },
    { id: "p2", name: "To Serve", ingredients: [row("i2")], steps: [step("s3", "Boil pasta.")] },
  ],
} as unknown as Recipe;

describe("parseLabFlags", () => {
  test("a recipe alone runs the default model on the whole recipe with the guide", () => {
    expect(parseLabFlags(["ragu"], "lite")).toEqual({ recipe: "ragu", part: null, models: ["lite"], rulesFile: null, showPrompt: false });
  });

  test("reads every flag, and splits the model list", () => {
    expect(parseLabFlags(["--model", "a, b,", "ragu", "--part", "To Serve", "--rules", "r.txt", "--prompt"], "lite")).toEqual({
      recipe: "ragu",
      part: "To Serve",
      models: ["a", "b"],
      rulesFile: "r.txt",
      showPrompt: true,
    });
  });

  test("refuses an unknown flag, a flag without a value, two recipes, and no recipe", () => {
    expect(() => parseLabFlags(["ragu", "--loud"], "lite")).toThrow(/Unknown argument --loud/);
    expect(() => parseLabFlags(["ragu", "--part"], "lite")).toThrow(/--part needs a value/);
    expect(() => parseLabFlags(["ragu", "--model", " , "], "lite")).toThrow(/--model needs at least one model/);
    expect(() => parseLabFlags(["ragu", "pie"], "lite")).toThrow(/One recipe at a time/);
    expect(() => parseLabFlags([], "lite")).toThrow(LAB_USAGE);
  });
});

describe("authorRecipe", () => {
  test("a recipe never restyled is already the author's", () => {
    expect(authorRecipe(recipe, null)).toBe(recipe);
  });

  test("a restyled one is rebuilt from the kept parts: their names, their rows with the author's notes, and their steps", () => {
    const rebuilt = authorRecipe(recipe, [
      { name: "Beef", rows: ["i2", "gone"], notes: ["", "?"], steps: [{ title: "", text: "Season beef - pat dry.", summary: "" }] },
      { name: "Pasta", rows: ["i1"], notes: ["whole"], steps: [] },
    ]);
    expect(rebuilt.parts.map((p) => p.name)).toEqual(["Beef", "Pasta"]);
    // A kept row the recipe no longer has is skipped.
    expect(rebuilt.parts.map((p) => p.ingredients.map((r) => [r.id, r.note]))).toEqual([[["i2", ""]], [["i1", "whole"]]]);
    expect(rebuilt.parts[0]!.steps).toEqual([{ id: "author:0:0", title: "", text: "Season beef - pat dry.", summary: "", ingredientIds: [], image: null }]);
  });
});

describe("onlyPart", () => {
  test("null is the whole recipe; a name is that part, case-insensitively; an unknown name says which parts there are", () => {
    expect(onlyPart(recipe, null)).toBe(recipe);
    expect(onlyPart(recipe, "to serve").parts.map((p) => p.id)).toEqual(["p2"]);
    expect(() => onlyPart(recipe, "Sauce")).toThrow(/No part named "Sauce"\. Parts: "", "Full recipe", "To Serve"/);
  });
});

test("rulesFromText is one statement per line, blanks and comments dropped", () => {
  expect(rulesFromText("# mine\nOne stage per step.\n\n  Plain words.  \n")).toEqual(["One stage per step.", "Plain words."]);
});

describe("the report", () => {
  const result: RestyleResult = {
    parts: [restyledPart("", []), restyledPart("Full recipe", ["Pat beef dry and sear."], [0]), restyledPart("To Serve", ["Boil the pasta."], [1])],
    check: {
      rebuilt: false,
      ok: false,
      missingFacts: ["2"],
      missingFoods: [],
      missingConditions: ["if it looks dry"],
      addedConditions: [],
      addedNumbers: ["1tbsp"],
      droppedWords: ["pooled", "juices"],
      rowMismatch: false,
      issues: [{ kind: "imperial", item: "2 inch", message: "“2 inch” is still imperial." }],
      parts: [],
    },
    revisions: [
      { problems: ["“cilantro” is not the household's word: coriander. Use the household's word."], taken: true },
      { problems: ["“skillet” is not the household's word: frying pan. Use the household's word."], taken: false },
    ],
  };

  test("heads with the model, the time and the verdict, names what changed and the counts, then each non-empty part", () => {
    expect(reportLines("lite", 2.345, recipe, result)).toEqual([
      "## lite  2.3s  check FAILED",
      "   dropped: 2",
      '   lost conditions: "if it looks dry"',
      "   added numbers: 1tbsp",
      "   dropped words: pooled juices",
      "   reads wrong: “2 inch” is still imperial.",
      "   sent back (1) with 1 to fix; the revision was better, and taken:",
      "     - “cilantro” is not the household's word: coriander. Use the household's word.",
      "   sent back (2) with 1 to fix; the revision was no better, and dropped:",
      "     - “skillet” is not the household's word: frying pan. Use the household's word.",
      "   3 -> 3 parts, 3 -> 2 steps",
      "",
      "--- Full recipe  1 line, 1 step",
      "1. Pat beef dry and sear.",
      "",
      "--- To Serve  1 line, 1 step",
      "1. Boil the pasta.",
    ]);
  });

  test("a passing check is one line before the counts", () => {
    const ok = {
      ...result,
      check: { ...result.check, ok: true, missingFacts: [], missingConditions: [], addedNumbers: [], droppedWords: [], rowMismatch: false, issues: [] },
      revisions: undefined,
    };
    expect(reportLines("lite", 1, recipe, ok)[0]).toBe("## lite  1.0s  check ok");
    expect(reportLines("lite", 1, recipe, ok)[1]).toBe("   3 -> 3 parts, 3 -> 2 steps");
  });

  test("a failure is one line with the message", () => {
    expect(failureLine("lite", 60, new Error("The model took too long to answer."))).toBe("## lite  60.0s  FAILED: The model took too long to answer.");
    expect(failureLine("lite", 0.5, "boom")).toBe("## lite  0.5s  FAILED: boom");
  });
});
