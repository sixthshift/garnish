// The model reading every page (M36.6, decisions.md row 77). Static render
// only (no jsdom in this project's vitest config), so the review is checked
// with `renderToString` and driven by calling the stage component directly;
// the read itself is `modelPass`, which is an ordinary async function of a
// reader and so can be given one that resolves, throws, or never answers at
// all.
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  changedLines,
  changeSummary,
  draftFromScraped,
  ImportReview,
  importSummary,
  type ModelReader,
  modelPass,
  rejectionMessage,
  shouldReadWithModel,
  withRejectedAnswer,
} from "../../src/components/RecipeSource";
import type { Food as FoodRow } from "../../src/db/models/food/repo";
import { reviewRows, rowCommit } from "../../src/domain/bulkIngredients";
import type { ImportCheck } from "../../src/domain/importCheck";
import type { Unit } from "../../src/domain/recipe";
import { ingredientLines, type ScrapedRecipe } from "../../src/domain/schemaRecipe";
import type { ImportedRecipe } from "../../src/server/recipeImport";

const gram: Unit = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
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

const rows = (recipe: ScrapedRecipe) => reviewRows(ingredientLines(recipe), { units, foods });

/** The first element in `node` whose `children` prop is exactly `text`. */
function elementWithChildren(node: ReactNode, text: string): ReactElement<Record<string, any>> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = elementWithChildren(child as ReactNode, text);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const element = node as ReactElement<Record<string, any>>;
  if (element.props.children === text) return element;
  return elementWithChildren(element.props.children as ReactNode, text);
}

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

describe("the review while the read runs", () => {
  test("the rules result renders at once, with the line saying what is still happening", () => {
    const html = renderToString(<ImportReview {...reviewProps} imported={rulesResult} rows={rows(rulesRecipe)} aiAvailable reading />);
    expect(html).toContain('data-testid="sorting-notice"');
    expect(html).toContain("Sorting into parts…");
    // The page's own reading is on the screen meanwhile.
    expect(html).toContain("Read 2 ingredients and 2 steps");
    expect(html.match(/data-review-row=""/g)).toHaveLength(2);
  });

  test("Create is not blocked while the read runs, and it commits the rules result", async () => {
    // A read that never answers: the review must not be waiting on it.
    let creates = 0;
    const node = ImportReview({
      ...reviewProps,
      imported: rulesResult,
      rows: rows(rulesRecipe),
      aiAvailable: true,
      reading: true,
      onCreate: () => (creates += 1),
    });
    const create = elementWithChildren(node, "Create");
    expect(create?.props.disabled).toBeFalsy();
    create?.props.onClick();
    expect(creates).toBe(1);

    const pending = modelPass(rulesResult, () => new Promise<ImportedRecipe>(() => {}));
    const draft = draftFromScraped({
      scraped: rulesResult.recipe,
      sourceUrl: rulesResult.url,
      commits: rows(rulesRecipe).map(rowCommit),
      createdFoods: new Map(),
      createdUnits: new Map(),
    });
    expect(draft.name).toBe("Lemon tart");
    expect(draft.parts).toHaveLength(1);
    expect(draft.parts[0]!.ingredients).toHaveLength(2);
    // The read is still out there; nothing above it waited.
    expect(await Promise.race([pending, Promise.resolve("still reading")])).toBe("still reading");
  });
});

describe("the review once the read lands", () => {
  test("the parts are the model's and the summary says so", () => {
    const landed: ImportedRecipe = { from: "ai", url: SOURCE, recipe: sortedRecipe, pageText: PAGE_TEXT, check: passingCheck };
    const html = renderToString(<ImportReview {...reviewProps} imported={landed} rows={rows(sortedRecipe)} aiAvailable />);
    expect(html).toContain('data-import-from="ai"');
    expect(html).toContain("sorted into parts by the model");
    expect(html).toContain("The words are the page&#x27;s own");
    expect(html).toContain('data-import-part="Pastry"');
    expect(html).toContain('data-import-part="Filling"');
    expect(html).not.toContain('data-testid="sorting-notice"');
  });

  test("a paste is still a reading rather than a sorting", () => {
    expect(importSummary("ai", 1, 2)).toContain("Claude read 1 ingredient and 2 steps");
  });
});

describe("a read that failed", () => {
  test("the rules result stays, with the error inline and a Try again", () => {
    const html = renderToString(
      <ImportReview
        {...reviewProps}
        imported={rulesResult}
        rows={rows(rulesRecipe)}
        aiAvailable
        readError="The model is rate-limited. Try again in a minute."
        onRetryRead={() => {}}
      />,
    );
    expect(html).toContain('data-testid="read-error"');
    expect(html).toContain("rate-limited");
    expect(html).toContain("Try again");
    // Nothing was lost: the page's own reading is still what is offered.
    expect(html).toContain("Read 2 ingredients and 2 steps");
    expect(html).toContain(">Create<");
  });

  test("Try again asks for the read again", () => {
    let retries = 0;
    const node = ImportReview({
      ...reviewProps,
      imported: rulesResult,
      rows: rows(rulesRecipe),
      aiAvailable: true,
      readError: "The model could not be reached.",
      onRetryRead: () => (retries += 1),
    });
    elementWithChildren(node, "Try again")?.props.onClick();
    expect(retries).toBe(1);
  });
});

describe("an answer the check rejected", () => {
  const rejectedResult: ImportedRecipe = {
    from: "schema",
    url: SOURCE,
    recipe: rulesRecipe,
    pageText: PAGE_TEXT,
    check: failingCheck,
    rejected: sortedRecipe,
  };

  test("changeSummary counts a rewording as one change, not two", () => {
    expect(changeSummary(failingCheck)).toBe("dropped 1 line and reworded 2 steps");
    expect(changeSummary({ ...passingCheck, ok: false, addedLines: ["1 pinch salt"] })).toBe("added 1 line");
    expect(changeSummary(passingCheck)).toBe("changed nothing");
  });

  test("rejectionMessage says what changed and which version won", () => {
    expect(rejectionMessage(failingCheck)).toBe("The model's version dropped 1 line and reworded 2 steps, so the page's version is shown.");
  });

  test("changedLines lists every line the check objected to", () => {
    expect(changedLines(failingCheck)).toEqual([
      { label: "Dropped", text: "100 g sugar" },
      { label: "Dropped step", text: "Rub in." },
      { label: "Dropped step", text: "Bake." },
      { label: "Added step", text: "Rub the butter in." },
      { label: "Added step", text: "Bake it." },
    ]);
  });

  test("the review shows the message, the lines, and the quiet way to take it anyway", () => {
    const html = renderToString(<ImportReview {...reviewProps} imported={rejectedResult} rows={rows(rulesRecipe)} aiAvailable onUseRejected={() => {}} />);
    expect(html).toContain('data-testid="rejected-notice"');
    expect(html).toContain("dropped 1 line and reworded 2 steps");
    expect(html).toContain("Rub the butter in.");
    expect(html).toContain("Use the model&#x27;s version anyway");
    // The page's version is what is on the screen and what Create would write.
    expect(html).toContain('data-import-from="schema"');
  });

  test("Use the model's version anyway swaps it in, and the notice goes with it", () => {
    let taken = 0;
    const node = ImportReview({
      ...reviewProps,
      imported: rejectedResult,
      rows: rows(rulesRecipe),
      aiAvailable: true,
      onUseRejected: () => (taken += 1),
    });
    elementWithChildren(node, "Use the model's version anyway")?.props.onClick();
    expect(taken).toBe(1);

    const swapped = withRejectedAnswer(rejectedResult);
    expect(swapped.from).toBe("ai");
    expect(swapped.recipe.parts.map((part) => part.name)).toEqual(["Pastry", "Filling"]);
    expect(swapped.rejected).toBeUndefined();
    expect(swapped.pageText).toBe(PAGE_TEXT);
    const html = renderToString(<ImportReview {...reviewProps} imported={swapped} rows={rows(sortedRecipe)} aiAvailable />);
    expect(html).not.toContain('data-testid="rejected-notice"');
    expect(html).toContain("sorted into parts by the model");
  });

  test("a result with nothing rejected says nothing about it", () => {
    const html = renderToString(<ImportReview {...reviewProps} imported={rulesResult} rows={rows(rulesRecipe)} aiAvailable />);
    expect(html).not.toContain('data-testid="rejected-notice"');
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
