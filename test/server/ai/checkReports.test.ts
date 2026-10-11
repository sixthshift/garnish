// The two model checks that refuse without failing — the restyle's facts check
// and the import's anchor check — become warnings in Settings › Diagnostics,
// so "the restyle failed" can be explained afterwards. A passing check is not.
import { expect, test } from "vitest";
import type { ImportedRecipe } from "../../../src/domain/import";
import type { RestyleCheck } from "../../../src/domain/style";
import { type RestyleResult, refusedCheckReport } from "../../../src/server/ai/restyle";
import { refusedImportReport } from "../../../src/server/fns/import";

const passing: RestyleCheck = {
  ok: true,
  missingFacts: [],
  missingFoods: [],
  missingConditions: [],
  addedConditions: [],
  addedNumbers: [],
  droppedWords: [],
  rowMismatch: false,
  parts: [],
};
const okPart = { ...passing, name: "", ok: true };

test("a restyle whose check passed is not reported", () => {
  expect(refusedCheckReport("Cookies", "sonnet", { parts: [], check: passing })).toBeNull();
});

test("a flagged restyle is a warning naming the recipe and model, with only the failing parts' reports", () => {
  const badPart = { ...okPart, name: "Topping", ok: false, missingFacts: ["325°F"] };
  const result: RestyleResult = { parts: [], check: { ...passing, ok: false, missingFacts: ["325°F"], parts: [okPart, badPart] } };
  expect(refusedCheckReport("Chewy Chocolate Chip Cookies", "sonnet", result)).toEqual({
    source: "ai",
    level: "warning",
    name: "restyle",
    message: 'The facts check flagged the rewrite of "Chewy Chocolate Chip Cookies"',
    detail: { recipe: "Chewy Chocolate Chip Cookies", model: "sonnet", check: { ...result.check, parts: [badPart] } },
  });
});

const imported = (check?: ImportedRecipe["check"]): ImportedRecipe => ({
  from: "ai",
  url: "https://example.com/cookies",
  recipe: { name: "Cookies", description: "", image: null, servings: 0, yieldText: "", prepMinutes: null, cookMinutes: null, tags: [], parts: [] },
  pageText: "",
  ...(check ? { check } : {}),
});

test("an import with no check, or a passing one, is not reported", () => {
  expect(refusedImportReport(imported())).toBeNull();
  expect(refusedImportReport(imported({ ok: true, missingLines: [], addedLines: [], missingSteps: [], addedSteps: [] }))).toBeNull();
});

test("a refused reading is a warning naming the recipe, with the page and the check", () => {
  const check = { ok: false, missingLines: ["1 egg yolk"], addedLines: [], missingSteps: [], addedSteps: [] };
  expect(refusedImportReport(imported(check))).toEqual({
    source: "ai",
    level: "warning",
    name: "import",
    message: `The anchor check refused the model's reading of "Cookies"`,
    detail: { url: "https://example.com/cookies", check },
  });
});
