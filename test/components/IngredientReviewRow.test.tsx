// The bulk-add review row (M17.5). Static render only (no jsdom in this
// project's vitest config), so the markup is checked with renderToString and
// the decisions by calling `IngredientReviewFields` directly and invoking its
// buttons — the same split `BulkAddFields` is tested with.
//
// The Check the task asks for is here: a mixed paste (one fully matched line,
// one unknown food, one text-only line) renders the three states, and
// declining "create" leaves the row text-only with nothing to create.
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  amountChip,
  chipText,
  IngredientReviewFields,
  type IngredientReviewFieldsProps,
  IngredientReviewRow,
  type IngredientReview,
} from "../../src/components/IngredientReviewRow";
import { reviewedIngredient } from "../../src/components/IngredientsEditor";
import { isTextOnly } from "../../src/components/IngredientsEditor";
import { pendingCreations, reviewRows, rowCommit } from "../../src/domain/bulkIngredients";
import { BulkReviewList } from "../../src/components/ui/BulkAddSheet";

const gram = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  standardQuantity: null,
  standardUnitId: null,
};
const cup = { ...gram, id: "ffffffff-ffff-4fff-8fff-ffffffffffff", name: "cup", pluralName: "cups", abbreviation: "", useAbbreviation: false, fraction: true };
const units = [gram, cup];

const flour = { id: "11111111-1111-4111-8111-111111111111", name: "flour", pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false, conversions: [] };
const foods = [flour];

/** A mixed paste: a matched line, an unknown food, and a line with nothing left to resolve. */
const PASTE = ["200 g flour, sifted", "100 g almond meal", "1 cup"];

function paste(): IngredientReview[] {
  return reviewRows(PASTE, { units, foods });
}

/** The first element in `node` whose `children` prop is exactly `text`, without rendering it. */
function elementWithChildren(node: ReactNode, text: string): ReactElement<Record<string, any>> {
  const found = search(node);
  if (!found) throw new Error(`no element with children ${JSON.stringify(text)}`);
  return found;

  function search(current: ReactNode): ReactElement<Record<string, any>> | null {
    if (Array.isArray(current)) {
      for (const child of current) {
        const hit = search(child as ReactNode);
        if (hit) return hit;
      }
      return null;
    }
    if (!isValidElement(current)) return null;
    const props = current.props as Record<string, unknown>;
    if (props.children === text) return current as ReactElement<Record<string, any>>;
    return search(props.children as ReactNode);
  }
}

function fields(row: IngredientReview, onChange: (next: IngredientReview) => void): IngredientReviewFieldsProps {
  return {
    row,
    label: "Line 1",
    unitOptions: [],
    foodOptions: [],
    unitQuery: row.unitText,
    foodQuery: row.foodText,
    onUnitQuery: () => {},
    onFoodQuery: () => {},
    onFoodFocus: () => {},
    onFoodBlur: () => {},
    onPickUnit: () => {},
    onPickFood: () => {},
    onChange,
  };
}

describe("amountChip / chipText", () => {
  test("the amount chip prints the quantity, with a leading = when it is fixed", () => {
    const rows = reviewRows(["2 cups flour", "=1 cup flour", "flour"], { units, foods });
    expect(rows.map(amountChip)).toEqual(["2", "=1", ""]);
  });

  test("a chip names the chosen row, the pending create, or the fallback", () => {
    expect(chipText({ kind: "existing", row: flour }, "text only")).toBe("flour");
    expect(chipText({ kind: "create", name: "almond meal" }, "text only")).toBe("create “almond meal”");
    expect(chipText({ kind: "none" }, "text only")).toBe("text only");
  });
});

describe("a mixed paste in the review list", () => {
  const html = renderToString(
    <BulkReviewList
      itemName="ingredient"
      rows={paste()}
      review={{
        rows: () => [],
        keyOf: (row: IngredientReview) => row.key,
        confirm: () => {},
        renderRow: (row: IngredientReview, index: number) => (
          <IngredientReviewRow row={row} label={`Line ${index + 1}`} unitMatches={() => units} searchFoods={async () => []} onChange={() => {}} />
        ),
      }}
      onRowsChange={() => {}}
    />,
  );

  test("every pasted line is listed, with its raw text and its state", () => {
    expect(html).toContain("3 ingredients to review");
    expect(html).toContain("Nothing is created until you press Add.");
    for (const line of PASTE) expect(html).toContain(line);
    expect(html.match(/data-status="matched"/g)).toHaveLength(1);
    expect(html.match(/data-status="review"/g)).toHaveLength(1);
    expect(html.match(/data-status="text"/g)).toHaveLength(1);
  });

  test("the matched line shows its unit and food as chips and asks nothing", () => {
    const matched = html.slice(html.indexOf('data-status="matched"'), html.indexOf('data-status="review"'));
    expect(matched).toContain(">gram<");
    expect(matched).toContain(">flour<");
    expect(matched).toContain(">sifted<");
    expect(matched).not.toContain("Unknown food");
    expect(matched).not.toContain("Unknown unit");
  });

  test("the unknown food is flagged, with create and pick-existing side by side", () => {
    expect(html).toContain("Unknown food “almond meal”");
    expect(html).toContain("Create “almond meal”");
    expect(html).toContain('aria-label="Line 2 food"');
    expect(html).toContain('placeholder="Pick an existing food"');
    // Nothing is chosen yet, so the food chip reads as the text-only fallback.
    expect(html).toContain(">text only<");
  });

  test("the text-only line proposes nothing at all", () => {
    const textOnly = html.slice(html.indexOf('data-status="text"'));
    expect(textOnly).not.toContain("Unknown food");
    expect(textOnly).not.toContain("Create “");
  });
});

describe("deciding an unknown food", () => {
  test("Create marks the row for creation and keeps the amount", () => {
    const row = paste()[1]!;
    let next: IngredientReview | null = null;
    const tree = IngredientReviewFields(fields(row, (updated) => (next = updated)));
    elementWithChildren(tree, "Create “almond meal”").props.onClick();
    const decided = next as unknown as IngredientReview;
    expect(decided.food).toEqual({ kind: "create", name: "almond meal" });
    expect(pendingCreations([decided])).toEqual({ foods: ["almond meal"], units: [] });
    expect(isTextOnly(reviewedIngredient(rowCommit(decided), new Map([["almond meal", flour]]), new Map()))).toBe(false);
  });

  test("declining leaves the row text-only and creates no food", () => {
    // Approve first, so declining is a real reversal rather than the default.
    const approved: IngredientReview = { ...paste()[1]!, food: { kind: "create", name: "almond meal" } };
    let next: IngredientReview | null = null;
    const tree = IngredientReviewFields(fields(approved, (updated) => (next = updated)));
    elementWithChildren(tree, "Leave as text").props.onClick();
    const declined = next as unknown as IngredientReview;
    expect(declined.food).toEqual({ kind: "none" });
    expect(pendingCreations([declined])).toEqual({ foods: [], units: [] });
    const ingredient = reviewedIngredient(rowCommit(declined), new Map(), new Map());
    expect(ingredient).toMatchObject({ food: null, unit: null, quantity: null, originalText: "100 g almond meal" });
    expect(isTextOnly(ingredient)).toBe(true);
  });

  test("an untouched paste creates nothing", () => {
    expect(pendingCreations(paste())).toEqual({ foods: [], units: [] });
  });
});

describe("deciding an unknown unit", () => {
  test("the parser's proposal is offered for creation and can be dropped again", () => {
    const row = reviewRows(["2 sprigs flour"], { units, foods })[0]!;
    expect(row.unitText).toBe("sprigs");
    let next: IngredientReview | null = null;
    const tree = IngredientReviewFields(fields(row, (updated) => (next = updated)));
    elementWithChildren(tree, "Create “sprigs”").props.onClick();
    const approved = next as unknown as IngredientReview;
    expect(approved.unit).toEqual({ kind: "create", name: "sprigs" });
    expect(pendingCreations([approved])).toEqual({ foods: [], units: ["sprigs"] });

    const dropped = elementWithChildren(IngredientReviewFields(fields(approved, (updated) => (next = updated))), "No unit");
    dropped.props.onClick();
    const declined = next as unknown as IngredientReview;
    expect(declined.unit).toEqual({ kind: "none" });
    // The row is still structured: only the unit went.
    expect(rowCommit(declined)).toMatchObject({ textOnly: false, quantity: 2, unit: null });
  });
});
