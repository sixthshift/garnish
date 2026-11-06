// The model sorting a page into parts before Check opens (decisions.md row 203).
// Static render only: the review is checked with `renderToString`, and the
// sort itself is `modelPass` and `sortedRead`, ordinary async functions of a
// reader, so a test can give one that resolves, throws or is rejected.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { Food as FoodRow } from "../../../../../src/db/models/food/repo";
import { ImportReview } from "../../../../../src/domain/recipes/components/new/ImportReview";
import {
  importSummary,
  type ModelReader,
  modelPass,
  SORT_NOTE,
  shouldReadWithModel,
  sortedRead,
} from "../../../../../src/domain/recipes/components/new/importSummary";
import { type ImportCheck, type ImportedRecipe, review, type ScrapedRecipe } from "../../../../../src/domain/recipes/import";
import { reviewRows } from "../../../../../src/domain/recipes/ingredient";
import type { Unit } from "../../../../../src/domain/recipes/reference";

const gram: Unit = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  portion: false,
  standardQuantity: null,
  standardUnitId: null,
};
const flour: FoodRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "flour",
  pluralName: null,
  aliases: [],
  aisleId: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};
const units = [gram];
const foods = [flour];

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

const reviewProps = {
  units,
  searchFoods: (async () => []) as (q: string) => Promise<FoodRow[]>,
  onRowsChange: () => {},
  onBack: () => {},
  onCreate: () => {},
};

const rows = (recipe: ScrapedRecipe) => reviewRows(review.ingredientLines(recipe), { units, foods });

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

describe("the review once the read lands", () => {
  test("the parts are the model's, and nothing says a read is still running", () => {
    const landed: ImportedRecipe = { from: "ai", url: SOURCE, recipe: sortedRecipe, pageText: PAGE_TEXT, check: passingCheck };
    const html = renderToString(<ImportReview {...reviewProps} imported={landed} rows={rows(sortedRecipe)} aiAvailable />);
    expect(html).toContain('data-import-part="Pastry"');
    expect(html).toContain('data-import-part="Filling"');
    expect(html).not.toContain("Sorting into parts");
    expect(html).not.toContain('data-testid="sort-note"');
  });

  test("a sort that did not land is one quiet line, not a warning", () => {
    const html = renderToString(<ImportReview {...reviewProps} imported={rulesResult} rows={rows(rulesRecipe)} aiAvailable sortNote={SORT_NOTE} />);
    expect(html).toContain('data-testid="sort-note"');
    expect(html).toContain("Couldn&#x27;t sort this into parts");
    expect(html).not.toContain("Use the model");
  });
});

describe("no model configured", () => {
  test("a schema page admits its sections were not sorted", () => {
    const html = renderToString(<ImportReview {...reviewProps} imported={rulesResult} rows={rows(rulesRecipe)} />);
    expect(html).toContain("Read 2 ingredients and 2 steps");
    expect(html).toContain("No model is configured");
    expect(html).toContain("every line is on the main body");
    expect(html).not.toContain('data-testid="sorting-notice"');
    expect(html).not.toContain('data-testid="read-error"');
  });

  test("the note is on the summary, not on the stub, which already says worse", () => {
    expect(importSummary("schema", 2, 2, false)).toContain("No model is configured");
    expect(importSummary("schema", 2, 2, null)).not.toContain("No model is configured");
    expect(importSummary("stub", 0, 0, false)).toContain("no recipe data");
  });
});
