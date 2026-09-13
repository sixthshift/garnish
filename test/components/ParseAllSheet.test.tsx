// Parse all (M21.3). Static render only (no jsdom in this project's vitest
// config), so the sheet's body is rendered directly and the commit is checked
// through the pure helpers.
//
// The Checks the task asks for are here: the banner shows on an all-text part
// and not on a mixed one, and confirming applies every approved row while
// leaving declined rows text-only.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { IngredientsEditor, isTextOnly, newIngredient } from "../../src/components/IngredientsEditor";
import {
  applyParsedRows,
  needsParseAll,
  ParseAllSheetContent,
  parseAllRows,
  parsedSummary,
  unparsedIndices,
} from "../../src/components/ParseAllSheet";
import { emptyDraft, type DraftIngredient, type RecipeDraft } from "../../src/components/RecipeForm";
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
const units = [gram];
const flour: FoodRow = { id: "11111111-1111-4111-8111-111111111111", name: "flour", pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false, conversions: [] };
const foods = [flour];
const vocabulary = { units, foods };

/** A text-only row holding `line`. */
function textRow(line: string): DraftIngredient {
  return { ...newIngredient(), originalText: line };
}

/** A structured row that already resolved to flour. */
function matchedRow(): DraftIngredient {
  return { ...newIngredient(), quantity: 200, unit: gram, food: { ...flour, aisle: null }, originalText: "200 g flour" };
}

/** A part whose every row is plain text. */
function unparsed(): RecipeDraft {
  const base = emptyDraft();
  return { ...base, parts: [{ ...base.parts[0]!, ingredients: [textRow("200 g flour"), textRow("100 g almond meal"), textRow("salt")] }] };
}

describe("unparsedIndices and needsParseAll", () => {
  test("only text-only rows with a raw line count", () => {
    const part = { ...emptyDraft().parts[0]!, ingredients: [textRow("200 g flour"), matchedRow(), newIngredient(), textRow("  ")] };
    expect(unparsedIndices(part.ingredients)).toEqual([0]);
  });

  test("the banner shows on an all-text part", () => {
    expect(needsParseAll(unparsed().parts[0]!)).toBe(true);
  });

  test("and not on a mixed one, an empty one, or one with nothing to read", () => {
    const base = emptyDraft().parts[0]!;
    expect(needsParseAll({ ...base, ingredients: [textRow("salt"), matchedRow()] })).toBe(false);
    expect(needsParseAll({ ...base, ingredients: [] })).toBe(false);
    expect(needsParseAll({ ...base, ingredients: [newIngredient()] })).toBe(false);
  });
});

describe("parseAllRows", () => {
  test("reads every unparsed row, keyed by its position", () => {
    const rows = parseAllRows(unparsed().parts[0]!.ingredients, vocabulary);
    expect(rows.map((row) => row.key)).toEqual(["0", "1", "2"]);
    expect(rows[0]!.originalText).toBe("200 g flour");
    // The known food and unit resolve; the unknown one is only proposed.
    expect(rows[0]!.food.kind).toBe("existing");
    expect(rows[0]!.unit.kind).toBe("existing");
    expect(rows[1]!.food.kind).toBe("none");
    expect(rows[1]!.foodText).toBe("almond meal");
  });

  test("keys stay the row's position even when earlier rows are already parsed", () => {
    const base = emptyDraft();
    const mixed = { ...base, parts: [{ ...base.parts[0]!, ingredients: [matchedRow(), textRow("200 g flour")] }] };
    expect(parseAllRows(mixed.parts[0]!.ingredients, vocabulary).map((row) => row.key)).toEqual(["1"]);
  });
});

describe("applyParsedRows", () => {
  test("applies what resolved and leaves what was declined as text", () => {
    const draft = unparsed();
    const next = applyParsedRows(draft, 0, parseAllRows(draft.parts[0]!.ingredients, vocabulary), new Map(), new Map());
    const [first, second, third] = next.parts[0]!.ingredients;
    expect(first!.food?.name).toBe("flour");
    expect(first!.quantity).toBe(200);
    expect(first!.unit?.name).toBe("gram");
    // The raw line survives the parse, always.
    expect(first!.originalText).toBe("200 g flour");
    expect(isTextOnly(second!)).toBe(true);
    expect(second!.originalText).toBe("100 g almond meal");
    expect(isTextOnly(third!)).toBe(true);
    // The row ids are the rows that were already there.
    expect(next.parts[0]!.ingredients.map((row) => row.id)).toEqual(draft.parts[0]!.ingredients.map((row) => row.id));
  });

  test("an approved food reaches its row once it has been created", () => {
    const almond: FoodRow = { ...flour, id: "22222222-2222-4222-8222-222222222222", name: "almond meal" };
    const draft = unparsed();
    const rows = parseAllRows(draft.parts[0]!.ingredients, vocabulary).map((row) =>
      row.foodText === "almond meal" ? { ...row, food: { kind: "create" as const, name: row.foodText } } : row,
    );
    const next = applyParsedRows(draft, 0, rows, new Map([["almond meal", almond]]), new Map());
    expect(next.parts[0]!.ingredients[1]!.food?.name).toBe("almond meal");
    expect(next.parts[0]!.ingredients[1]!.quantity).toBe(100);
  });

  test("no rows, or an out-of-range part, changes nothing", () => {
    const draft = unparsed();
    expect(applyParsedRows(draft, 0, [], new Map(), new Map()).parts).toEqual(draft.parts);
    expect(applyParsedRows(draft, 9, parseAllRows(draft.parts[0]!.ingredients, vocabulary), new Map(), new Map()).parts).toEqual(draft.parts);
  });
});

describe("parsedSummary", () => {
  test.each([
    [1, "1 line read. Nothing is created unless you ask for it below."],
    [3, "3 lines read. Nothing is created unless you ask for it below."],
  ])("%i -> %s", (count, expected) => {
    expect(parsedSummary(count)).toBe(expected);
  });
});

describe("ParseAllSheetContent", () => {
  const props = {
    units,
    searchFoods: (async () => []) as (q: string) => Promise<FoodRow[]>,
    onRowsChange: () => {},
    onApply: () => {},
    onCancel: () => {},
  };

  test("one review row per line, with Apply and Cancel", () => {
    const draft = unparsed();
    const html = renderToString(<ParseAllSheetContent {...props} rows={parseAllRows(draft.parts[0]!.ingredients, vocabulary)} />);
    expect(html).toContain('data-parse-all=""');
    expect(html).toContain("3 lines read");
    expect(html.match(/data-review-row=""/g)).toHaveLength(3);
    expect(html).toContain('data-status="matched"');
    expect(html).toContain("Unknown food “almond meal”");
    expect(html).toContain(">Apply<");
    expect(html).toContain(">Cancel<");
  });

  test("Apply is disabled while there is nothing to apply", () => {
    expect(renderToString(<ParseAllSheetContent {...props} rows={[]} />)).toMatch(/<button[^>]*disabled=""[^>]*>Apply</);
  });
});

describe("the banner in the ingredients editor", () => {
  test("shows on an all-text part", () => {
    const html = renderToString(<IngredientsEditor draft={unparsed()} pi={0} units={units} onChange={() => {}} />);
    expect(html).toContain('data-testid="parse-all-banner"');
    expect(html).toContain("Nothing here is parsed");
    expect(html).toContain(">Parse all<");
  });

  test("and not once any row has a food", () => {
    const draft = unparsed();
    const mixed: RecipeDraft = { ...draft, parts: [{ ...draft.parts[0]!, ingredients: [matchedRow(), textRow("salt")] }] };
    const html = renderToString(<IngredientsEditor draft={mixed} pi={0} units={units} onChange={() => {}} />);
    expect(html).not.toContain('data-testid="parse-all-banner"');
  });

  test("and not on an empty part", () => {
    const html = renderToString(<IngredientsEditor draft={emptyDraft()} pi={0} units={units} onChange={() => {}} />);
    expect(html).not.toContain('data-testid="parse-all-banner"');
  });
});
