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
import { BulkReviewList } from "../../../../src/components/ui/bulk/BulkReviewList";
import { type IngredientReview, isTextOnly, reviewedIngredient } from "../../../../src/domain/draft";
import { pendingCreations, reviewRows, rowCommit, rowStatus } from "../../../../src/domain/ingredient";
import {
  asText,
  IngredientReviewFields,
  type IngredientReviewFieldsProps,
  NO_UNIT,
  withoutUnit,
} from "../../../../src/routes/recipes/components/IngredientReviewFields";
import { foodSearchWords, IngredientReviewRow, suggestFoods } from "../../../../src/routes/recipes/components/IngredientReviewRow";
import { amountChip, chipText } from "../../../../src/routes/recipes/components/reviewChips";

const gram = {
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
const cup = {
  ...gram,
  id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  name: "cup",
  pluralName: "cups",
  abbreviation: "",
  useAbbreviation: false,
  fraction: true,
  portion: false,
};
const units = [gram, cup];

const flour = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "flour",
  pluralName: null,
  aliases: [],
  aisleId: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};
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

/** The first element in `node` whose `aria-label` is `label`, without rendering it. */
function withLabel(node: ReactNode, label: string): ReactElement<Record<string, any>> {
  const found = tryLabel(node, label);
  if (!found) throw new Error(`no element labelled ${JSON.stringify(label)}`);
  return found;
}

function tryLabel(node: ReactNode, label: string): ReactElement<Record<string, any>> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = tryLabel(child as ReactNode, label);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const props = node.props as Record<string, unknown>;
  if (props["aria-label"] === label) return node as ReactElement<Record<string, any>>;
  return tryLabel(props.children as ReactNode, label);
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
    onPickUnit: (option) => {
      if (option.value === NO_UNIT.value) onChange(withoutUnit(row));
    },
    onPickFood: () => {},
    onLeaveAsText: () => onChange(asText(row)),
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
    />
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
    expect(matched).not.toContain("isn’t one of your");
    // A matched row still has its pickers, holding what was matched, to correct a wrong match.
    expect(matched).toMatch(/aria-label="Line 1 food"[^>]*value="flour"|value="flour"[^>]*aria-label="Line 1 food"/);
  });

  test("the unknown food is flagged under a picker holding the page's word", () => {
    expect(html).toContain("“almond meal” isn’t one of your foods");
    expect(html).toMatch(/aria-label="Line 2 food"[^>]*value="almond meal"|value="almond meal"[^>]*aria-label="Line 2 food"/);
    // Nothing is chosen yet, so the food chip reads as the text-only fallback.
    expect(html).toContain(">text only<");
  });

  test("the text-only line proposes nothing at all", () => {
    const textOnly = html.slice(html.indexOf('data-status="text"'));
    expect(textOnly).not.toContain("isn’t one of your");
  });
});

describe("deciding an unknown food", () => {
  test("Create marks the row for creation and keeps the amount", () => {
    const row = paste()[1]!;
    let next: IngredientReview | null = null;
    const tree = IngredientReviewFields(fields(row, (updated) => (next = updated)));
    // Enter on the typed name, nothing of that name in the list: Create.
    withLabel(tree, "Line 1 food").props.onSubmit("almond meal");
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
    withLabel(tree, "Line 1 unit").props.onSubmit("sprigs");
    const approved = next as unknown as IngredientReview;
    expect(approved.unit).toEqual({ kind: "create", name: "sprigs" });
    expect(pendingCreations([approved])).toEqual({ foods: [], units: ["sprigs"] });

    const unitField = withLabel(IngredientReviewFields(fields(approved, (updated) => (next = updated))), "Line 1 unit");
    unitField.props.onSuggestionSelect(unitField.props.suggestions[0]);
    const declined = next as unknown as IngredientReview;
    expect(declined.unit).toEqual({ kind: "none" });
    // The row is still structured: only the unit went.
    expect(rowCommit(declined)).toMatchObject({ textOnly: false, quantity: 2, unit: null });
  });

  test("a word that is no unit is said so at once, and goes to the note", () => {
    const carrot = { ...flour, id: "66666666-6666-4666-8666-666666666666", name: "carrot" };
    const row = reviewRows(["1 small carrot, peeled"], { units, foods: [carrot] })[0]!;
    expect(row).toMatchObject({ unitText: "small", note: "peeled" });
    expect(rowStatus(row)).toBe("review");
    let next: IngredientReview | null = null;
    const unitField = withLabel(IngredientReviewFields(fields(row, (updated) => (next = updated))), "Line 1 unit");
    // "No unit" is the picker's first row, ahead of the units and the create row.
    expect(unitField.props.suggestions[0]).toMatchObject({ value: "No unit" });
    expect(unitField.props.suggestions.at(-1)).toMatchObject({ label: "Create “small”" });
    unitField.props.onSuggestionSelect(unitField.props.suggestions[0]);
    const decided = next as unknown as IngredientReview;
    expect(decided).toMatchObject({ unit: { kind: "none" }, unitText: "", note: "small, peeled" });
    expect(rowStatus(decided)).toBe("matched");
    expect(pendingCreations([decided])).toEqual({ foods: [], units: [] });
    expect(rowCommit(decided)).toMatchObject({ textOnly: false, quantity: 1, unit: null, note: "small, peeled" });
  });
});

describe("suggesting an existing food", () => {
  const sugar = { ...flour, id: "22222222-2222-4222-8222-222222222222", name: "sugar" };
  const casterSugar = { ...flour, id: "33333333-3333-4333-8333-333333333333", name: "caster sugar" };
  const library = [casterSugar, flour, sugar];
  const calls: string[] = [];
  /** `listFoods` as the server answers it: every food for no text, else those whose name contains it. */
  const searchFoods = async (q: string) => {
    calls.push(q);
    const key = q.trim().toLowerCase();
    return library.filter((food) => food.name.includes(key));
  };

  test("an empty picker lists every food, so it can be browsed", async () => {
    expect((await suggestFoods(searchFoods, "  ")).map((food) => food.name)).toEqual(["caster sugar", "flour", "sugar"]);
  });

  test("text a name contains is searched as it is", async () => {
    calls.length = 0;
    expect((await suggestFoods(searchFoods, "sug")).map((food) => food.name)).toEqual(["caster sugar", "sugar"]);
    expect(calls).toEqual(["sug"]);
  });

  test("the page's phrase that matches nothing falls back to its words, the most matched first", async () => {
    // "caster sugar" matches two words, "sugar" one; "white" and "sifted" match nothing.
    expect((await suggestFoods(searchFoods, "white caster sugar, sifted")).map((food) => food.name)).toEqual(["caster sugar", "sugar"]);
    expect((await suggestFoods(searchFoods, "raw sugar")).map((food) => food.name)).toEqual(["caster sugar", "sugar"]);
  });

  test("short words and repeats are not searched on their own", () => {
    expect(foodSearchWords("2 x of Sugar, sugar & flour")).toEqual(["sugar", "flour"]);
  });
});
