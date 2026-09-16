// The restyle lab's pure half: flags, the recipe rebuilt from the author's steps, and the report. The CLI itself is one wiring block and is not run here.
import { describe, expect, test } from "vitest";
import type { Recipe } from "../../../src/domain/recipe";
import type { RestyleResult } from "../../../src/server/ai/restyle";
import { authorRecipe, failureLine, LAB_USAGE, onlyPart, parseLabFlags, reportLines, rulesFromText } from "../../../src/server/ai/restyleLab";

const step = (id: string, text: string) => ({ id, text, ingredientIds: [], image: null });
const recipe = {
  name: "Ragu",
  parts: [
    { id: "p0", name: "", ingredients: [], steps: [] },
    { id: "p1", name: "Full recipe", ingredients: [], steps: [step("s1", "Pat beef dry."), step("s2", "Sear beef.")] },
    { id: "p2", name: "To Serve", ingredients: [], steps: [step("s3", "Boil pasta.")] },
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
  test("puts the author's steps back where a part kept them, keeping step ids where there is one, and leaves the rest", () => {
    const rebuilt = authorRecipe(recipe, new Map([["p1", ["Season beef - pat dry.", "Sear - brown all over.", "Remove."]]]));
    expect(rebuilt.parts[1]!.steps.map((s) => s.text)).toEqual(["Season beef - pat dry.", "Sear - brown all over.", "Remove."]);
    expect(rebuilt.parts[1]!.steps.map((s) => s.id)).toEqual(["s1", "s2", "p1:author:2"]);
    expect(rebuilt.parts[2]).toBe(recipe.parts[2]);
    expect(rebuilt.parts[0]).toBe(recipe.parts[0]);
  });

  test("a part whose current steps are gone still gets its author's steps", () => {
    const bare = { ...recipe, parts: [{ ...recipe.parts[1]!, steps: [] }] } as Recipe;
    expect(authorRecipe(bare, new Map([["p1", ["Sear."]]])).parts[0]!.steps).toEqual([{ id: "p1:author:0", text: "Sear.", ingredientIds: [], image: null }]);
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
    parts: [
      { name: "", steps: [] },
      { name: "Full recipe", steps: ["Pat beef dry and sear."] },
      { name: "To Serve", steps: ["Boil the pasta."] },
    ],
    check: {
      ok: false,
      missingFacts: ["2"],
      missingFoods: [],
      addedNumbers: ["1tbsp"],
      parts: [],
    },
  };

  test("heads with the model, the time and the verdict, names what changed, then each non-empty part with its step counts", () => {
    expect(reportLines("lite", 2.345, recipe, result)).toEqual([
      "## lite  2.3s  check FAILED",
      "   dropped: 2",
      "   added numbers: 1tbsp",
      "",
      "--- Full recipe  2 -> 1 steps",
      "1. Pat beef dry and sear.",
      "",
      "--- To Serve  1 -> 1 steps",
      "1. Boil the pasta.",
    ]);
  });

  test("a passing check is one line before the parts", () => {
    const ok = { ...result, check: { ...result.check, ok: true, missingFacts: [], addedNumbers: [] } };
    expect(reportLines("lite", 1, recipe, ok)[0]).toBe("## lite  1.0s  check ok");
    expect(reportLines("lite", 1, recipe, ok)[1]).toBe("");
  });

  test("a failure is one line with the message", () => {
    expect(failureLine("lite", 60, new Error("The model took too long to answer."))).toBe("## lite  60.0s  FAILED: The model took too long to answer.");
    expect(failureLine("lite", 0.5, "boom")).toBe("## lite  0.5s  FAILED: boom");
  });
});
