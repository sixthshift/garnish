// The model sorting a page into parts before Check opens (decisions.md row 203):
// `modelPass` and `sortedRead` are ordinary async functions of a reader, so a
// test can give one that resolves, throws or is rejected.
import { describe, expect, test } from "vitest";
import { type ModelReader, modelPass, SORT_NOTE, shouldReadWithModel, sortedRead } from "../../../../../src/domain/recipes/components/new/importSummary";
import type { ImportCheck, ImportedRecipe, ScrapedRecipe } from "../../../../../src/domain/recipes/import";

const SOURCE = "https://example.test/lemon-tart";
const PAGE_TEXT = "# Pastry\n200 g flour\n# Filling\n100 g sugar\nRub in.\nBake.";

/** What the rules rung gets off a page with sections: every line on the main body. */
const rulesRecipe: ScrapedRecipe = {
  name: "Lemon tart",
  description: "",
  image: null,
  servings: 8,
  yieldText: "",
  prepMinutes: null,
  cookMinutes: null,
  tags: [],
  parts: [{ name: "", ingredients: ["200 g flour", "100 g sugar"], steps: ["Rub in.", "Bake."] }],
};

/** The same lines, sorted under the page's headings, which is the whole of what the model is asked for. */
const sortedRecipe: ScrapedRecipe = {
  ...rulesRecipe,
  parts: [
    { name: "Pastry", ingredients: ["200 g flour"], steps: ["Rub in."] },
    { name: "Filling", ingredients: ["100 g sugar"], steps: ["Bake."] },
  ],
};

const passingCheck: ImportCheck = { ok: true, missingLines: [], addedLines: [], missingSteps: [], addedSteps: [] };
const failingCheck: ImportCheck = {
  ok: false,
  missingLines: ["100 g sugar"],
  addedLines: [],
  missingSteps: ["Rub in.", "Bake."],
  addedSteps: ["Rub the butter in.", "Bake it."],
};

const rulesResult: ImportedRecipe = { from: "schema", url: SOURCE, recipe: rulesRecipe, pageText: PAGE_TEXT };
const stubResult: ImportedRecipe = {
  from: "stub",
  url: SOURCE,
  recipe: { ...rulesRecipe, parts: [{ name: "", ingredients: [], steps: [] }] },
  pageText: PAGE_TEXT,
};

describe("shouldReadWithModel", () => {
  test("a page's rules result goes to the model, anchored or not", () => {
    expect(shouldReadWithModel(rulesResult, true)).toBe(true);
    expect(shouldReadWithModel(stubResult, true)).toBe(true);
  });

  test("no model configured, no read", () => {
    expect(shouldReadWithModel(rulesResult, false)).toBe(false);
  });

  test("an upload or a paste is already read, and a page with no text has nothing to read", () => {
    expect(shouldReadWithModel({ ...rulesResult, from: "mealie" }, true)).toBe(false);
    expect(shouldReadWithModel({ ...rulesResult, from: "tandoor" }, true)).toBe(false);
    expect(shouldReadWithModel({ ...rulesResult, from: "ai" }, true)).toBe(false);
    expect(shouldReadWithModel({ ...rulesResult, pageText: "   " }, true)).toBe(false);
  });

  // M36.7: pasted HTML runs the whole pipeline on the server, so what comes
  // back already carries a check. Reading it again asks the same question twice.
  test("a result the server already had the model read is shown as it stands", () => {
    const checked = { ...rulesResult, check: { ok: true, missingLines: [], addedLines: [], missingSteps: [], addedSteps: [] } };
    expect(shouldReadWithModel(checked, true)).toBe(false);
    expect(shouldReadWithModel({ ...checked, check: { ...checked.check, ok: false, addedLines: ["a pinch of salt"] } }, true)).toBe(false);
  });
});

describe("modelPass", () => {
  test("a schema result is sent with the page's text and its own reading as the anchor", async () => {
    const seen: { text: string; anchor?: ScrapedRecipe }[] = [];
    const read: ModelReader = async (text, anchor) => {
      seen.push({ text, anchor });
      return { from: "ai", url: "", recipe: sortedRecipe, pageText: "", check: passingCheck };
    };
    const outcome = await modelPass(rulesResult, read);
    expect(seen).toEqual([{ text: PAGE_TEXT, anchor: rulesRecipe }]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // The address and the page's text come from the rules result, so a retry or
    // a swap afterwards still has everything the first read had.
    expect(outcome.result.url).toBe(SOURCE);
    expect(outcome.result.pageText).toBe(PAGE_TEXT);
    expect(outcome.result.from).toBe("ai");
    expect(outcome.result.recipe.parts.map((part) => part.name)).toEqual(["Pastry", "Filling"]);
  });

  test("a stub is sent with no anchor: there is nothing to hold the model to", async () => {
    const seen: (ScrapedRecipe | undefined)[] = [];
    await modelPass(stubResult, async (_text, anchor) => {
      seen.push(anchor);
      return { from: "ai", url: "", recipe: sortedRecipe, pageText: "" };
    });
    expect(seen).toEqual([undefined]);
  });

  test("a failure comes back as a message, not a throw", async () => {
    const outcome = await modelPass(rulesResult, async () => {
      throw new Error("The model is rate-limited. Try again in a minute.");
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toContain("rate-limited");
  });
});

describe("sortedRead", () => {
  test("a sort the check kept is what Check opens on, with no note", async () => {
    const sorted = await sortedRead(rulesResult, async () => ({ from: "ai", url: "", recipe: sortedRecipe, pageText: "", check: passingCheck }));
    expect(sorted.note).toBeNull();
    expect(sorted.imported.from).toBe("ai");
    expect(sorted.imported.url).toBe(SOURCE);
    expect(sorted.imported.recipe.parts.map((part) => part.name)).toEqual(["Pastry", "Filling"]);
  });

  test("a sort that failed opens on the page's own reading, with the quiet note", async () => {
    const sorted = await sortedRead(rulesResult, async () => {
      throw new Error("The model is rate-limited. Try again in a minute.");
    });
    expect(sorted.imported).toBe(rulesResult);
    expect(sorted.note).toBe(SORT_NOTE);
  });

  test("a sort the check rejected is not offered: the page's own reading, with the note", async () => {
    const sorted = await sortedRead(rulesResult, async () => ({
      from: "schema",
      url: "",
      recipe: rulesRecipe,
      pageText: "",
      check: failingCheck,
      rejected: sortedRecipe,
    }));
    expect(sorted.imported).toBe(rulesResult);
    expect(sorted.note).toBe(SORT_NOTE);
  });
});
