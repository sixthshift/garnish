// The import screen (M19.2). Static render only (no jsdom in this project's
// vitest config), so the markup is checked with `renderToString` and the
// decisions by calling the two stage components directly and invoking their
// buttons — the same split `IngredientReviewFields` and `BulkAddFields` are
// tested with.
//
// The Checks the task asks for are here: the three states (paste, review,
// form), Start blank reaching the form on `emptyDraft()`, and a declined food
// landing a text-only row.
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  draftFromImport,
  importSummary,
  RecipeImportPaste,
  RecipeImportReview,
} from "../../src/components/RecipeImport";
import type { IngredientReview } from "../../src/components/IngredientReviewRow";
import { isTextOnly } from "../../src/components/IngredientsEditor";
import { emptyDraft } from "../../src/components/RecipeForm";
import { pendingCreations, reviewRows, rowCommit } from "../../src/domain/bulkIngredients";
import type { Food as FoodRow } from "../../src/db/models/food/repo";
import type { Unit } from "../../src/domain/recipe";

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
const cup: Unit = { ...gram, id: "ffffffff-ffff-4fff-8fff-ffffffffffff", name: "cup", pluralName: "cups", abbreviation: "", useAbbreviation: false, fraction: true };
const units = [gram, cup];

const flour: FoodRow = { id: "11111111-1111-4111-8111-111111111111", name: "flour", pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false };
const foods = [flour];

const PASTE = `Anzac biscuits

Ingredients
200 g flour
100 g almond meal

Method
1. Mix them.
2. Bake them.`;

/** The review rows the shell would build from `PASTE`'s ingredient lines. */
function rows(): IngredientReview[] {
  return reviewRows(["200 g flour", "100 g almond meal"], { units, foods });
}

const noFoods = async () => [];
const props = {
  units,
  searchFoods: noFoods as (q: string) => Promise<FoodRow[]>,
  onTitleChange: () => {},
  onRowsChange: () => {},
  onBack: () => {},
  onCreate: () => {},
};

/** The first element in `node` whose `children` prop is exactly `text`, without rendering it. */
function elementWithChildren(node: ReactNode, text: string): ReactElement<Record<string, any>> | null {
  if (!isValidElement(node)) {
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = elementWithChildren(child, text);
        if (found) return found;
      }
    }
    return null;
  }
  const element = node as ReactElement<Record<string, any>>;
  if (element.props.children === text) return element;
  return elementWithChildren(element.props.children as ReactNode, text);
}

describe("importSummary", () => {
  test.each([
    [3, 2, "3 ingredients and 2 steps"],
    [1, 0, "1 ingredient"],
    [0, 1, "1 step"],
    [0, 0, "nothing we could read"],
  ])("(%i, %i) -> %s", (ingredients, steps, expected) => {
    expect(importSummary(ingredients, steps)).toBe(expected);
  });
});

describe("RecipeImportPaste", () => {
  test("renders the paste stage with both ways out", () => {
    const html = renderToString(<RecipeImportPaste text="" onTextChange={() => {}} onContinue={() => {}} onBlank={() => {}} />);
    expect(html).toContain('data-import-stage="paste"');
    expect(html).toContain("Continue");
    expect(html).toContain("Start blank");
  });

  test("Continue is disabled until something is pasted", () => {
    const blank = elementWithChildren(RecipeImportPaste({ text: "  ", onTextChange: () => {}, onContinue: () => {}, onBlank: () => {} }), "Continue");
    expect(blank?.props.disabled).toBe(true);
    const typed = elementWithChildren(RecipeImportPaste({ text: PASTE, onTextChange: () => {}, onContinue: () => {}, onBlank: () => {} }), "Continue");
    expect(typed?.props.disabled).toBe(false);
  });

  test("Start blank hands the form an empty draft", () => {
    let handed: ReturnType<typeof emptyDraft> | null = null;
    const node = RecipeImportPaste({ text: "", onTextChange: () => {}, onContinue: () => {}, onBlank: () => (handed = emptyDraft()) });
    elementWithChildren(node, "Start blank")?.props.onClick();
    // The part carries a fresh random id, so compare everything but that.
    const blank = emptyDraft();
    expect(handed).not.toBeNull();
    expect({ ...handed!, parts: handed!.parts.map((part) => ({ ...part, id: "" })) }).toEqual({ ...blank, parts: blank.parts.map((part) => ({ ...part, id: "" })) });
  });
});

describe("RecipeImportReview", () => {
  test("renders what the paste was read as", () => {
    const html = renderToString(<RecipeImportReview {...props} title="Anzac biscuits" rows={rows()} steps={["Mix them.", "Bake them."]} />);
    expect(html).toContain('data-import-stage="review"');
    expect(html).toContain("Read as 2 ingredients and 2 steps");
    expect(html).toContain("Anzac biscuits");
    // One review row per ingredient line, in the shape bulk add reviews.
    expect(html.match(/data-review-row=""/g)).toHaveLength(2);
    // The matched line is matched; the unknown food is still waiting.
    expect(html).toContain('data-status="matched"');
    expect(html).toContain('data-status="review"');
    expect(html).toContain("Unknown food “almond meal”");
    expect(html).toContain("Mix them.");
    expect(html).toContain("Bake them.");
  });

  test("says so when a paste yielded only one of the two lists", () => {
    const ingredientsOnly = renderToString(<RecipeImportReview {...props} title="" rows={rows()} steps={[]} />);
    expect(ingredientsOnly).toContain("No steps found");
    const stepsOnly = renderToString(<RecipeImportReview {...props} title="" rows={[]} steps={["Mix them."]} />);
    expect(stepsOnly).toContain("No ingredient lines found");
  });

  test("Create is the primary and Back returns to the paste", () => {
    let backs = 0;
    let creates = 0;
    const node = RecipeImportReview({ ...props, title: "", rows: rows(), steps: [], onBack: () => (backs += 1), onCreate: () => (creates += 1) });
    elementWithChildren(node, "Back")?.props.onClick();
    elementWithChildren(node, "Create")?.props.onClick();
    expect(backs).toBe(1);
    expect(creates).toBe(1);
  });
});

describe("draftFromImport", () => {
  test("a reviewed paste becomes a draft in the unnamed part", () => {
    const draft = draftFromImport({
      title: "Anzac biscuits",
      commits: rows().map(rowCommit),
      steps: ["Mix them.", "Bake them."],
      createdFoods: new Map(),
      createdUnits: new Map(),
    });
    expect(draft.name).toBe("Anzac biscuits");
    expect(draft.parts).toHaveLength(1);
    expect(draft.parts[0]!.name).toBe("");
    expect(draft.parts[0]!.steps.map((step) => step.text)).toEqual(["Mix them.", "Bake them."]);
    // Every other field is still the blank recipe's.
    const { name, parts, ...rest } = draft;
    const { name: _n, parts: _p, ...blank } = emptyDraft();
    expect(rest).toEqual(blank);
  });

  test("a matched line is structured and a declined food is text only", () => {
    const draft = draftFromImport({
      title: null,
      commits: rows().map(rowCommit),
      steps: [],
      createdFoods: new Map(),
      createdUnits: new Map(),
    });
    const [matched, declined] = draft.parts[0]!.ingredients;
    expect(matched!.food?.name).toBe("flour");
    expect(matched!.quantity).toBe(200);
    expect(matched!.unit?.name).toBe("gram");
    expect(isTextOnly(declined!)).toBe(true);
    expect(declined!.originalText).toBe("100 g almond meal");
    expect(declined!.food).toBeNull();
  });

  test("declining every proposal creates nothing", () => {
    expect(pendingCreations(rows())).toEqual({ foods: [], units: [] });
  });

  test("an approved food reaches the row once it has been created", () => {
    const almond: FoodRow = { ...flour, id: "22222222-2222-4222-8222-222222222222", name: "almond meal" };
    const approved = rows().map((row) => (row.foodText === "" ? row : { ...row, food: { kind: "create" as const, name: row.foodText } }));
    expect(pendingCreations(approved)).toEqual({ foods: ["almond meal"], units: [] });
    const draft = draftFromImport({
      title: null,
      commits: approved.map(rowCommit),
      steps: [],
      createdFoods: new Map([["almond meal", almond]]),
      createdUnits: new Map(),
    });
    expect(draft.parts[0]!.ingredients[1]!.food?.name).toBe("almond meal");
    expect(draft.parts[0]!.ingredients[1]!.originalText).toBe("100 g almond meal");
  });

  test("no title leaves the name blank for the form to require", () => {
    expect(draftFromImport({ title: null, commits: [], steps: [], createdFoods: new Map(), createdUnits: new Map() }).name).toBe("");
  });
});
