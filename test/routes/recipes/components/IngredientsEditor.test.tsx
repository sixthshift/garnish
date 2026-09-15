// The ingredient editor's pure helpers, its rendering, and the Check for M5.4:
// a component holding a normal row, a row with no quantity and a new food, and
// a text-only row saves through createRecipe and reads back intact, with the
// new food created by name.
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BulkInlinePanel } from "../../../../src/components/ui/bulk/BulkInlinePanel";
import {
  addIngredient,
  addPart,
  addReviewedIngredients,
  addStep,
  type DraftIngredient,
  type DraftPart,
  emptyDraft,
  filterUnits,
  foodReference,
  type IngredientReview,
  ingredientSummary,
  isTextOnly,
  linkIngredient,
  matchUnit,
  moveIngredient,
  moveIngredientTo,
  newIngredient,
  parsedRowPatch,
  parseQuantity,
  parseRowFor,
  quantityText,
  type RecipeDraft,
  removeIngredient,
  renamePart,
  reviewedIngredient,
  textOnlyPatch,
  unitReference,
  updateIngredient,
  validateDraft,
} from "../../../../src/domain/draft";
import { pendingCreations, type ReviewRow, reviewRows, rowCommit } from "../../../../src/domain/ingredient";
import { EMPTY_INGREDIENT_SUMMARY, IngredientFields, type IngredientFieldsProps } from "../../../../src/routes/recipes/components/IngredientFields";
import { confirmReviewedIngredients, ingredientReview } from "../../../../src/routes/recipes/components/ingredientReview";
import { INGREDIENT_DRAG_GROUP, IngredientsEditor } from "../../../../src/routes/recipes/components/IngredientsEditor";
import { findOrCreateFood, listFoods } from "../../../../src/server/fns/foods";
import { createRecipe, getRecipe } from "../../../../src/server/fns/recipes";
import { callServerFn, useTempDataDir } from "../../../helpers/server";

useTempDataDir();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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

/** Two components, Pastry (two rows) and Filling (one row), built with the helpers. */
function tart(): RecipeDraft {
  let draft = renamePart({ ...emptyDraft(), name: "Lemon tart" }, 0, "Pastry");
  draft = addPart(draft, "Filling");
  draft = addIngredient(draft, 0);
  draft = updateIngredient(draft, 0, 0, { quantity: 200, unit: gram, food: foodReference({ name: "flour" }) });
  draft = addIngredient(draft, 0);
  draft = updateIngredient(draft, 0, 1, { quantity: 1, unit: cup, note: "cold" });
  draft = addIngredient(draft, 1);
  draft = updateIngredient(draft, 1, 0, { quantity: 3, food: foodReference({ name: "lemon" }) });
  return draft;
}

/** The opening tag of the control carrying `label`. */
function tagWithLabel(html: string, label: string): string {
  const match = html.match(new RegExp(`<(?:button|input)[^>]*aria-label="${label}"[^>]*>`));
  if (!match) throw new Error(`no control labelled ${label}`);
  return match[0];
}

describe("parseQuantity", () => {
  test.each([
    ["", null],
    ["   ", null],
    ["1/2", 0.5],
    ["1 1/2", 1.5],
    ["1  1/2", 1.5],
    ["0.5", 0.5],
    [".5", 0.5],
    ["2", 2],
    ["2.", 2],
    ["abc", null],
    ["1/0", null],
    ["1 1", null],
    ["½", 0.5],
    ["1½", 1.5],
    ["2 ¾", 2.75],
    ["-1", -1],
    ["-1/2", -0.5],
    ["1.5.2", null],
  ])("parseQuantity(%j) -> %s", (text, expected) => {
    expect(parseQuantity(text)).toBe(expected);
  });

  test("quantityText is the inverse for committed values", () => {
    expect(quantityText(null)).toBe("");
    expect(quantityText(undefined)).toBe("");
    expect(quantityText(1.5)).toBe("1.5");
    expect(quantityText(0)).toBe("0");
  });
});

describe("newIngredient, isTextOnly, textOnlyPatch", () => {
  test("a new row is blank and structured, with a fresh uuid", () => {
    const row = newIngredient();
    expect(row).toMatchObject({ quantity: null, unit: null, food: null, note: "", originalText: "", fixed: false });
    expect(row.id).toMatch(UUID);
    expect(newIngredient().id).not.toBe(row.id);
    expect(isTextOnly(row)).toBe(false);
  });

  test("text only means no food and some original text", () => {
    expect(isTextOnly({ originalText: "a pinch of salt" })).toBe(true);
    expect(isTextOnly({ originalText: "   " })).toBe(false);
    expect(isTextOnly({ originalText: "2 eggs", food: foodReference({ name: "egg" }) })).toBe(false);
  });

  test("the mode patches clear what the other mode owns", () => {
    expect(textOnlyPatch(true)).toEqual({ quantity: null, unit: null, food: null, fixed: false });
    expect(textOnlyPatch(false)).toEqual({ originalText: "" });
  });
});

describe("foodReference and unitReference", () => {
  test("a listFoods row becomes a document food with a null aisle", () => {
    const ref = foodReference({
      id: gram.id,
      name: "Flour",
      pluralName: null,
      aliases: ["plain flour"],
      aisleId: "aisle-1",
      recipeId: null,
      skipShopping: false,
      conversions: [],
    });
    expect(ref).toEqual({
      id: gram.id,
      name: "Flour",
      pluralName: null,
      aliases: ["plain flour"],
      aisle: null,
      recipeId: null,
      skipShopping: false,
      conversions: [],
    });
  });

  test("a name alone becomes a new reference with defaults and a client uuid", () => {
    const ref = foodReference({ name: "  yeast " });
    expect(ref).toMatchObject({ name: "yeast", pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false, conversions: [] });
    expect(ref.id).toMatch(UUID);
    const unit = unitReference(" handful ");
    expect(unit).toMatchObject({
      name: "handful",
      pluralName: null,
      abbreviation: "",
      useAbbreviation: false,
      fraction: true,
      standardQuantity: null,
      standardUnitId: null,
    });
    expect(unit.id).toMatch(UUID);
  });

  test("both pass the document schema inside a recipe", () => {
    const draft = updateIngredient(addIngredient({ ...emptyDraft(), name: "Toast" }, 0), 0, 0, {
      food: foodReference({ name: "bread" }),
      unit: unitReference("slice"),
    });
    expect(validateDraft(draft).ok).toBe(true);
  });
});

describe("matchUnit and filterUnits", () => {
  test("matchUnit matches name, abbreviation or plural, ignoring case", () => {
    expect(matchUnit(units, "GRAM")).toBe(gram);
    expect(matchUnit(units, "g")).toBe(gram);
    expect(matchUnit(units, "cups")).toBe(cup);
    expect(matchUnit(units, "")).toBeUndefined();
    expect(matchUnit(units, "gra")).toBeUndefined();
  });

  test("filterUnits is a case-insensitive substring over the same fields; blank is everything", () => {
    expect(filterUnits(units, "")).toEqual(units);
    expect(filterUnits(units, "GR")).toEqual([gram]);
    expect(filterUnits(units, "cups")).toEqual([cup]);
    expect(filterUnits(units, "zzz")).toEqual([]);
  });
});

describe("addIngredient, updateIngredient, removeIngredient", () => {
  test("addIngredient appends a blank row to the indexed component only", () => {
    const draft = addPart(emptyDraft(), "Filling");
    const next = addIngredient(draft, 1);
    expect(next.parts[0]!.ingredients).toHaveLength(0);
    expect(next.parts[1]!.ingredients).toHaveLength(1);
    expect(next.parts[1]!.ingredients[0]!.id).toMatch(UUID);
    expect(draft.parts[1]!.ingredients).toHaveLength(0);
    expect(next.parts[0]).toBe(draft.parts[0]);
  });

  test("updateIngredient merges a patch into one row, leaving the rest alone", () => {
    const draft = tart();
    const next = updateIngredient(draft, 0, 1, { note: "chilled", fixed: true });
    expect(next.parts[0]!.ingredients[1]).toMatchObject({ quantity: 1, unit: cup, note: "chilled", fixed: true });
    expect(next.parts[0]!.ingredients[0]).toBe(draft.parts[0]!.ingredients[0]);
    expect(next.parts[1]).toBe(draft.parts[1]);
    expect(draft.parts[0]!.ingredients[1]!.note).toBe("cold");
  });

  test("removeIngredient drops one row", () => {
    const draft = tart();
    const next = removeIngredient(draft, 0, 0);
    expect(next.parts[0]!.ingredients.map((r) => r.note)).toEqual(["cold"]);
    expect(draft.parts[0]!.ingredients).toHaveLength(2);
  });

  test("out-of-range indices return an unchanged copy", () => {
    const draft = tart();
    for (const next of [
      addIngredient(draft, 2),
      updateIngredient(draft, 0, 5, { note: "x" }),
      updateIngredient(draft, -1, 0, {}),
      removeIngredient(draft, 1, 1),
      removeIngredient(draft, 3, 0),
    ]) {
      expect(next.parts).toEqual(draft.parts);
      expect(next.parts).not.toBe(draft.parts);
    }
  });
});

describe("moveIngredient", () => {
  test("appends the row to the target component and removes it from the source", () => {
    const draft = tart();
    const moved = draft.parts[0]!.ingredients[0]!;
    const next = moveIngredient(draft, 0, 0, 1);
    expect(next.parts[0]!.ingredients.map((r) => r.note)).toEqual(["cold"]);
    expect(next.parts[1]!.ingredients).toHaveLength(2);
    expect(next.parts[1]!.ingredients[1]).toBe(moved);
    expect(draft.parts[0]!.ingredients).toHaveLength(2);
    expect(draft.parts[1]!.ingredients).toHaveLength(1);
  });

  test("same component or out-of-range indices return an unchanged copy", () => {
    const draft = tart();
    for (const next of [moveIngredient(draft, 0, 0, 0), moveIngredient(draft, 0, 2, 1), moveIngredient(draft, 0, 0, 2), moveIngredient(draft, 5, 0, 1)]) {
      expect(next.parts).toEqual(draft.parts);
      expect(next.parts).not.toBe(draft.parts);
    }
  });
});

describe("moveIngredientTo", () => {
  test("a drag drops the row at the index it was released over", () => {
    const draft = tart();
    const moved = draft.parts[0]!.ingredients[0]!;
    const next = moveIngredientTo(draft, 0, 0, 1, 0);
    expect(next.parts[1]!.ingredients[0]).toBe(moved);
    expect(next.parts[1]!.ingredients).toHaveLength(2);
    expect(next.parts[0]!.ingredients.map((r) => r.note)).toEqual(["cold"]);
  });

  test("an index past the end appends, and a negative one lands first", () => {
    const draft = tart();
    const moved = draft.parts[0]!.ingredients[1]!;
    expect(moveIngredientTo(draft, 0, 1, 1, 99).parts[1]!.ingredients[1]).toBe(moved);
    expect(moveIngredientTo(draft, 0, 1, 1, -3).parts[1]!.ingredients[0]).toBe(moved);
  });

  test("with no index it appends, which is what the move-to select does", () => {
    const draft = tart();
    expect(moveIngredientTo(draft, 0, 0, 1)).toEqual(moveIngredient(draft, 0, 0, 1));
  });

  test("same component or out-of-range indices return an unchanged copy", () => {
    const draft = tart();
    for (const next of [moveIngredientTo(draft, 0, 0, 0, 0), moveIngredientTo(draft, 0, 9, 1, 0), moveIngredientTo(draft, 0, 0, 7, 0)]) {
      expect(next.parts).toEqual(draft.parts);
      expect(next.parts).not.toBe(draft.parts);
    }
  });
});

// The bulk-add path after the review step (M17.5): a reviewed line only
// commits a structured row when its food resolved, and a declined one falls
// back to the text-only row bulk add used to produce for every line.
const flourRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "flour",
  pluralName: null,
  aliases: [],
  aisleId: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};

function reviewOf(line: string): ReviewRow<typeof gram, typeof flourRow> {
  return reviewRows([line], { units, foods: [flourRow] })[0]!;
}

describe("reviewedIngredient", () => {
  test("a matched line commits quantity, unit, food and the raw line", () => {
    const row = reviewOf("200 g flour, sifted");
    const ingredient = reviewedIngredient(rowCommit(row), new Map(), new Map());
    expect(ingredient).toMatchObject({ quantity: 200, note: "sifted", originalText: "200 g flour, sifted" });
    expect(ingredient.unit?.name).toBe("gram");
    expect(ingredient.food?.name).toBe("flour");
    expect(ingredient.id).toMatch(UUID);
  });

  test("an approved food is taken from the created map, keyed by the approved name", () => {
    const almond = { ...flourRow, id: "22222222-2222-4222-8222-222222222222", name: "Almond Meal" };
    const row = reviewOf("100 g almond meal");
    const approved = { ...row, food: { kind: "create" as const, name: row.foodText } };
    const ingredient = reviewedIngredient(rowCommit(approved), new Map([["almond meal", almond]]), new Map());
    expect(ingredient.food?.id).toBe(almond.id);
    expect(isTextOnly(ingredient)).toBe(false);
  });

  test("declining the food leaves a text-only row holding the pasted line", () => {
    const row = reviewOf("100 g almond meal");
    expect(row.food.kind).toBe("none");
    const ingredient = reviewedIngredient(rowCommit(row), new Map(), new Map());
    expect(ingredient).toMatchObject({ quantity: null, unit: null, food: null, note: "", fixed: false, originalText: "100 g almond meal" });
    expect(isTextOnly(ingredient)).toBe(true);
  });

  test("an approved food whose creation is missing falls back to text only rather than inventing a reference", () => {
    const row = reviewOf("100 g almond meal");
    const approved = { ...row, food: { kind: "create" as const, name: row.foodText } };
    expect(isTextOnly(reviewedIngredient(rowCommit(approved), new Map(), new Map()))).toBe(true);
  });

  test("a declined unit leaves a structured row with no unit", () => {
    const row = reviewOf("2 sprigs flour");
    expect(row.unitText).toBe("sprigs");
    const ingredient = reviewedIngredient(rowCommit(row), new Map(), new Map());
    expect(ingredient).toMatchObject({ quantity: 2, unit: null });
    expect(ingredient.food?.name).toBe("flour");
  });
});

describe("addReviewedIngredients", () => {
  test("appends one row per reviewed line, in order, to the named component only", () => {
    const draft = tart();
    const rows = reviewRows(["200 g flour", "a pinch of pixie dust"], { units, foods: [flourRow] });
    const next = addReviewedIngredients(draft, 1, rows.map(rowCommit), new Map(), new Map());
    expect(next.parts[1]!.ingredients).toHaveLength(3);
    expect(next.parts[1]!.ingredients[1]).toMatchObject({ quantity: 200, originalText: "200 g flour" });
    expect(next.parts[1]!.ingredients[2]).toMatchObject({ originalText: "a pinch of pixie dust", food: null, quantity: null });
    expect(isTextOnly(next.parts[1]!.ingredients[2]!)).toBe(true);
    expect(next.parts[0]).toBe(draft.parts[0]);
    expect(draft.parts[1]!.ingredients).toHaveLength(1);
  });

  test("no rows, or an out-of-range component, returns an unchanged copy", () => {
    const draft = tart();
    const rows = reviewRows(["x"], { units, foods: [flourRow] }).map(rowCommit);
    for (const next of [addReviewedIngredients(draft, 0, [], new Map(), new Map()), addReviewedIngredients(draft, 5, rows, new Map(), new Map())]) {
      expect(next.parts).toEqual(draft.parts);
      expect(next.parts).not.toBe(draft.parts);
    }
  });

  test("the result still validates", () => {
    const rows = reviewRows(["200 g flour", "salt to taste"], { units, foods: [flourRow] }).map(rowCommit);
    const draft = addReviewedIngredients({ ...emptyDraft(), name: "Toast" }, 0, rows, new Map(), new Map());
    expect(validateDraft(draft).ok).toBe(true);
  });
});

describe("IngredientsEditor", () => {
  test("has a Bulk add button beside Add ingredient, and the sheet is closed by default", () => {
    const html = renderToString(<IngredientsEditor draft={tart()} pi={0} units={units} onChange={() => {}} />);
    expect(html).toContain(">Bulk add<");
    expect(html).toContain(">Add ingredient<");
    expect(html).not.toContain('role="dialog"');
  });

  test("each row has a drag handle and the list joins the shared drag group", () => {
    const draft = tart();
    const html = renderToString(<IngredientsEditor draft={draft} pi={0} units={units} onChange={() => {}} />);
    expect(html).toContain(`data-reorder-group="${INGREDIENT_DRAG_GROUP}"`);
    expect(html.match(/aria-label="Drag ingredient \d"/g)).toHaveLength(2);
    // The move-to select survives alongside the handle.
    expect(html).toContain("Move to…");
  });

  test("renders the row inputs for a part: quantity, unit, food, note, fixed, text toggle, move-to", () => {
    const draft = tart();
    const html = renderToString(<IngredientsEditor draft={draft} pi={0} units={units} onChange={() => {}} />);
    expect(html).toContain(">Add ingredient<");
    expect(html).not.toContain("No ingredients yet");
    expect(tagWithLabel(html, "Ingredient 1 quantity")).toContain('value="200"');
    expect(tagWithLabel(html, "Ingredient 1 quantity")).toContain('name="parts.0.ingredients.0.quantity"');
    expect(tagWithLabel(html, "Ingredient 1 unit")).toContain('value="gram"');
    expect(tagWithLabel(html, "Ingredient 1 unit")).toContain('role="combobox"');
    expect(tagWithLabel(html, "Ingredient 1 food")).toContain('value="flour"');
    expect(tagWithLabel(html, "Ingredient 1 note")).toContain('value=""');
    expect(tagWithLabel(html, "Ingredient 2 quantity")).toContain('value="1"');
    expect(tagWithLabel(html, "Ingredient 2 unit")).toContain('value="cup"');
    expect(tagWithLabel(html, "Ingredient 2 food")).toContain('value=""');
    expect(tagWithLabel(html, "Ingredient 2 note")).toContain('value="cold"');
    expect(html.match(/aria-label="Ingredient \d fixed"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Ingredient \d text only"/g)).toHaveLength(2);
    expect(tagWithLabel(html, "Ingredient 1 text only")).toContain('aria-pressed="false"');
    // Move-to offers the other component, by name.
    expect(html).toContain('aria-label="Move ingredient 1 to part"');
    expect(html).toContain("Move to…");
    // Reorder and remove controls per row; the food list does not query on the server.
    expect(html.match(/aria-label="Move ingredient \d up"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Remove ingredient \d"/g)).toHaveLength(2);
    expect(html).not.toContain('role="listbox"');
  });

  test("a text-only row shows one text input and no amount fields", () => {
    const draft = updateIngredient(addIngredient({ ...emptyDraft(), name: "Toast" }, 0), 0, 0, { originalText: "a pinch of salt" });
    const html = renderToString(<IngredientsEditor draft={draft} pi={0} units={units} onChange={() => {}} />);
    expect(tagWithLabel(html, "Ingredient 1 text")).toContain('value="a pinch of salt"');
    expect(tagWithLabel(html, "Ingredient 1 text")).toContain('name="parts.0.ingredients.0.originalText"');
    expect(tagWithLabel(html, "Ingredient 1 text only")).toContain('aria-pressed="true"');
    expect(html).not.toContain("Ingredient 1 quantity");
    expect(html).not.toContain("Ingredient 1 food");
    // A sole component has nowhere to move to.
    expect(html).not.toContain("Move to…");
  });

  test("an empty component offers the textarea; disabled disables the inputs and the add button; a quantity error shows on its row", () => {
    const empty = renderToString(<IngredientsEditor draft={emptyDraft()} pi={0} units={units} onChange={() => {}} />);
    expect(empty).not.toContain("No ingredients yet");
    expect(empty).toContain("One ingredient per line");

    const html = renderToString(
      <IngredientsEditor draft={tart()} pi={0} units={units} onChange={() => {}} disabled errors={{ "parts.0.ingredients.1.quantity": "Too small" }} />
    );
    expect(tagWithLabel(html, "Ingredient 1 quantity")).toContain('disabled=""');
    expect(tagWithLabel(html, "Ingredient 1 food")).toContain('disabled=""');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Add ingredient</);
    expect(tagWithLabel(html, "Ingredient 2 quantity")).toContain('aria-invalid="true"');
    expect(tagWithLabel(html, "Ingredient 1 quantity")).not.toContain("aria-invalid");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Too small");
  });

  test("an unknown component index renders nothing", () => {
    expect(renderToString(<IngredientsEditor draft={emptyDraft()} pi={3} units={units} onChange={() => {}} />)).toBe("");
  });
});

// M27.2: entry is text first. An empty list is a textarea, Add runs the same
// review the sheet runs but in place, and Confirm lands the rows through the
// same `confirmReviewedIngredients` — so a declined food still lands text-only.
describe("Text-first ingredients (M27.2)", () => {
  /** The very review the editor hands both the sheet and the inline panel. */
  const inlineReview = (confirm: (rows: IngredientReview[]) => void | Promise<void> = () => {}) => ingredientReview({ units, foods: [flourRow], confirm });

  test("empty: the list renders a textarea, one ingredient per line, and no structured row", () => {
    const html = renderToString(<IngredientsEditor draft={emptyDraft()} pi={0} units={units} onChange={() => {}} />);
    expect(html).not.toContain("No ingredients yet");
    expect(html).toContain('aria-label="New ingredients"');
    expect(html).toContain("One ingredient per line");
    expect(html).toContain(">Add<");
    expect(html).not.toContain("Ingredient 1 quantity");
    expect(html).not.toContain("Ingredient 1 food");
    // Bulk add stays in the header, and so does Add ingredient for a single row.
    expect(html).toContain(">Bulk add<");
    expect(html).toContain(">Add ingredient<");
  });

  test("reviewing: the textarea is replaced by the rows the sheet shows, with Back and Confirm", () => {
    const review = inlineReview();
    const rows = review.rows(["200 g flour", "100 g almond meal"]);
    const html = renderToString(
      <BulkInlinePanel
        itemName="ingredient"
        review={review}
        text="200 g flour\n100 g almond meal"
        rows={rows}
        onTextChange={() => {}}
        onRowsChange={() => {}}
        onAdvance={() => {}}
        onBack={() => {}}
      />
    );
    expect(html).not.toContain("One ingredient per line");
    expect(html).toContain("2 ingredients to review");
    expect(html).toContain("Nothing is created until you press Confirm.");
    expect(html).toContain(">Back<");
    expect(html).toContain(">Confirm<");
    // The review rows themselves: line 1 matched outright, line 2 offers to create its unknown food.
    expect(html).toContain('data-status="matched"');
    expect(html).toContain('data-status="review"');
    expect(html).toContain('aria-label="Line 2 food"');
    expect(html).toContain("Unknown food “almond meal”");
    expect(html).toContain("flour");
  });

  test("populated: the textarea is gone and the structured rows are back", () => {
    const html = renderToString(<IngredientsEditor draft={tart()} pi={0} units={units} onChange={() => {}} />);
    expect(html).not.toContain("One ingredient per line");
    expect(html).not.toContain('aria-label="New ingredients"');
    expect(html).toContain('aria-label="Ingredient 1 quantity"');
    expect(html).toContain(">Bulk add<");
  });

  test("Confirm lands a declined food as a text-only row holding the pasted line", async () => {
    const draft = { ...emptyDraft(), name: "Toast" };
    let landed: RecipeDraft | null = null;
    const review = inlineReview(async (rows) => {
      landed = await confirmReviewedIngredients(rows, draft, 0);
    });
    const rows = review.rows(["200 g flour", "100 g almond meal"]);
    // Nothing is approved by default, so the unknown food creates nothing.
    expect(rows[1]!.food.kind).toBe("none");
    expect(pendingCreations(rows)).toEqual({ foods: [], units: [] });

    await review.confirm(rows);
    const ingredients = landed!.parts[0]!.ingredients;
    expect(ingredients).toHaveLength(2);
    expect(ingredients[0]).toMatchObject({ quantity: 200, originalText: "200 g flour" });
    expect(ingredients[0]!.food?.name).toBe("flour");
    expect(ingredients[1]).toMatchObject({ quantity: null, unit: null, food: null, originalText: "100 g almond meal" });
    expect(isTextOnly(ingredients[1]!)).toBe(true);
    expect(validateDraft(landed!).ok).toBe(true);
  });
});

describe("Check: null quantity and text-only rows save", () => {
  test("three rows round-trip through createRecipe and getRecipe, and the new food is created", async () => {
    let draft: RecipeDraft = { ...emptyDraft(), name: "Seasoned toast" };
    draft = addIngredient(draft, 0);
    draft = updateIngredient(draft, 0, 0, { quantity: 2, unit: unitReference("slice"), food: foodReference({ name: "bread" }), note: "thick" });
    draft = addIngredient(draft, 0);
    draft = updateIngredient(draft, 0, 1, { quantity: null, food: foodReference({ name: "butter" }), note: "to taste" });
    draft = addIngredient(draft, 0);
    draft = updateIngredient(draft, 0, 2, { originalText: "a pinch of flaky salt" });
    const rows = (draft.parts[0] as DraftPart).ingredients;
    expect(rows.map(isTextOnly)).toEqual([false, false, true]);

    const parsed = validateDraft(draft);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const created = await callServerFn(createRecipe, parsed.data);
    const fetched = await callServerFn(getRecipe, { slug: created.slug });
    expect(fetched).toEqual(created);
    const [bread, butter, salt] = fetched.parts[0]!.ingredients;
    expect(fetched.parts[0]!.ingredients).toHaveLength(3);

    // Normal row: quantity, unit and food resolved to stored rows.
    expect(bread).toMatchObject({ quantity: 2, note: "thick", originalText: "", fixed: false });
    expect(bread!.unit).toMatchObject({ name: "slice" });
    expect(bread!.food).toMatchObject({ name: "bread" });

    // Null quantity survives as null, not 0, and its food is there.
    expect(butter!.quantity).toBeNull();
    expect(butter!.unit).toBeNull();
    expect(butter!.food).toMatchObject({ name: "butter" });
    expect(butter!.note).toBe("to taste");

    // Text-only row: no food, originalText preserved.
    expect(salt).toMatchObject({ quantity: null, unit: null, food: null, originalText: "a pinch of flaky salt", note: "" });

    // The foods the rows named were created on save, once each, with the server's own ids.
    const foods = await callServerFn(listFoods, {});
    expect(foods.map((f) => f.name).sort()).toEqual(["bread", "butter"]);
    expect(bread!.food!.id).toBe(foods.find((f) => f.name === "bread")!.id);
    expect(bread!.food!.id).not.toBe(rows[0]!.food!.id);
  });

  test("a row moved to another component saves there", async () => {
    let draft = addPart({ ...emptyDraft(), name: "Two part" }, "Sauce");
    draft = addIngredient(draft, 0);
    draft = updateIngredient(draft, 0, 0, { quantity: 1, food: foodReference({ name: "onion" }) });
    draft = moveIngredient(draft, 0, 0, 1);
    const parsed = validateDraft(draft);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const created = await callServerFn(createRecipe, parsed.data);
    const fetched = await callServerFn(getRecipe, { slug: created.slug });
    expect(fetched.parts[0]!.ingredients).toEqual([]);
    expect(fetched.parts[1]!.ingredients).toHaveLength(1);
    expect(fetched.parts[1]!.ingredients[0]!.food).toMatchObject({ name: "onion" });
  });
});

// --- M13.2 phone rows -------------------------------------------------------

/** The first element in `node` carrying `aria-label`, without rendering it. `IngredientFields` has no hooks, so its tree can be walked directly. */
function elementWithLabel(node: ReactNode, label: string): ReactElement<Record<string, any>> {
  const found = search(node);
  if (!found) throw new Error(`no element labelled ${label}`);
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
    if (props["aria-label"] === label) return current as ReactElement<Record<string, any>>;
    return search(props.children as ReactNode);
  }
}

/** The props `IngredientEditRow` hands `IngredientFields`, for row `ii` of part 0. */
function fieldProps(draft: RecipeDraft, ii: number, onPatch: (patch: Partial<DraftIngredient>) => void): IngredientFieldsProps {
  const ingredient = draft.parts[0]!.ingredients[ii]!;
  return {
    ingredient,
    path: `parts.0.ingredients.${ii}`,
    label: `Ingredient ${ii + 1}`,
    units,
    errors: {},
    textOnly: isTextOnly(ingredient),
    quantityDraft: null,
    unitText: ingredient.unit?.name ?? "",
    foodText: ingredient.food?.name ?? "",
    foodRows: [],
    onPatch,
    onQuantityText: () => {},
    onUnitText: () => {},
    onUnitBlur: () => {},
    onFoodText: () => {},
    onFoodFocus: () => {},
    onFoodBlur: () => {},
  };
}

describe("ingredientSummary", () => {
  test("is the formatted line for a structured row", () => {
    const draft = tart();
    expect(ingredientSummary(draft.parts[0]!.ingredients[0]!)).toBe("200 g flour");
    expect(ingredientSummary(draft.parts[0]!.ingredients[1]!)).toBe("1 cup, cold");
    expect(ingredientSummary(draft.parts[1]!.ingredients[0]!)).toBe("3 lemon");
  });

  test("is the raw line for a text-only row, and blank for an empty one", () => {
    expect(ingredientSummary({ originalText: "a pinch of salt" })).toBe("a pinch of salt");
    expect(ingredientSummary(newIngredient())).toBe("");
  });

  test("survives a reference with only a name on it", () => {
    const row = { quantity: 2, unit: unitReference("slice"), food: foodReference({ name: "bread" }) };
    expect(ingredientSummary(row)).toBe("2 slice bread");
  });
});

describe("IngredientsEditor at both widths", () => {
  test("phone gets a one-line summary with a chevron; the inline fields are md-only", () => {
    const html = renderToString(<IngredientsEditor draft={tart()} pi={0} units={units} onChange={() => {}} />);

    // Phone: one tappable line per row, hidden from md up.
    const summary = html.match(/<button[^>]*aria-label="Edit ingredient 1"[^>]*>/)?.[0] ?? "";
    expect(summary).toContain("md:hidden");
    expect(summary).toContain('aria-expanded="false"');
    expect(html).toContain(">200 g flour<");
    expect(html).toContain(">1 cup, cold<");
    expect(html.match(/aria-label="Edit ingredient \d"/g)).toHaveLength(2);
    expect(html).toContain("m9 18 6-6-6-6");

    // From md: the inline fields, hidden below it. The sheet is closed, so it is not in the markup.
    const inline = html.match(/<div[^>]*data-inline-fields=""[^>]*>/g) ?? [];
    expect(inline).toHaveLength(2);
    expect(inline[0]).toContain("hidden md:flex");
    expect(html.match(/aria-label="Ingredient \d quantity"/g)).toHaveLength(2);
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("Original text");
  });

  test("an empty row's summary reads as new, and a text-only row shows its raw line", () => {
    const blank = renderToString(<IngredientsEditor draft={addIngredient(emptyDraft(), 0)} pi={0} units={units} onChange={() => {}} />);
    expect(blank).toContain(`>${EMPTY_INGREDIENT_SUMMARY}<`);

    const text = updateIngredient(addIngredient(emptyDraft(), 0), 0, 0, { originalText: "a pinch of salt" });
    const html = renderToString(<IngredientsEditor draft={text} pi={0} units={units} onChange={() => {}} />);
    const summary = html.match(/<button[^>]*aria-label="Edit ingredient 1"[^>]*>/)?.[0] ?? "";
    expect(summary).toContain("md:hidden");
    expect(html).toContain(">a pinch of salt<");
  });

  test("a parsed row's original text prints in grey above the inline fields, not the phone summary (M13.6)", () => {
    const draft = updateIngredient(tart(), 0, 0, { originalText: "200g plain flour" });
    const html = renderToString(<IngredientsEditor draft={draft} pi={0} units={units} onChange={() => {}} />);

    expect(html.match(/data-original-text-above=""/g)).toHaveLength(1);
    expect(html).toMatch(/data-original-text-above=""[^>]*>200g plain flour</);

    // The phone summary shows the formatted line, not the raw original text.
    const summary = html.match(/<button[^>]*aria-label="Edit ingredient 1"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
    expect(summary).toContain(">200 g flour<");
    expect(summary).not.toContain("200g plain flour");
  });

  test("no grey line when there is no original text, or when the row is text only", () => {
    const html = renderToString(<IngredientsEditor draft={tart()} pi={0} units={units} onChange={() => {}} />);
    expect(html).not.toContain("data-original-text-above");

    const text = updateIngredient(addIngredient(emptyDraft(), 0), 0, 0, { originalText: "a pinch of salt" });
    const withText = renderToString(<IngredientsEditor draft={text} pi={0} units={units} onChange={() => {}} />);
    expect(withText).not.toContain("data-original-text-above");
  });
});

describe("the phone sheet's fields", () => {
  test("hold the same controls plus a read-only original text line", () => {
    const draft = updateIngredient(tart(), 0, 0, { originalText: "200g plain flour" });
    const html = renderToString(<IngredientFields {...fieldProps(draft, 0, () => {})} showOriginalText />);
    expect(tagWithLabel(html, "Ingredient 1 quantity")).toContain('value="200"');
    expect(tagWithLabel(html, "Ingredient 1 unit")).toContain('value="gram"');
    expect(tagWithLabel(html, "Ingredient 1 food")).toContain('value="flour"');
    expect(html).toContain("Original text");
    expect(html).toContain("200g plain flour");
    // Read only: the raw line is not an input.
    expect(html).not.toContain('name="parts.0.ingredients.0.originalText"');
  });

  test("a row with no original text says so, and a text-only row edits the line instead", () => {
    const plain = renderToString(<IngredientFields {...fieldProps(tart(), 0, () => {})} showOriginalText />);
    expect(plain).toContain("—");

    const text = updateIngredient(addIngredient(emptyDraft(), 0), 0, 0, { originalText: "a pinch of salt" });
    const html = renderToString(<IngredientFields {...fieldProps(text, 0, () => {})} showOriginalText />);
    expect(tagWithLabel(html, "Ingredient 1 text")).toContain('value="a pinch of salt"');
    expect(html).not.toContain("Original text");
  });

  test("editing in the sheet saves back into the draft", () => {
    const draft = tart();
    let next: RecipeDraft | null = null;
    const tree = IngredientFields({
      ...fieldProps(draft, 1, (patch) => {
        next = updateIngredient(draft, 0, 1, patch);
      }),
      showOriginalText: true,
    });

    elementWithLabel(tree, "Ingredient 2 quantity").props.onChange({ target: { value: "1 1/2" } });
    expect(next!.parts[0]!.ingredients[1]!.quantity).toBe(1.5);
    expect(draft.parts[0]!.ingredients[1]!.quantity).toBe(1);

    elementWithLabel(tree, "Ingredient 2 note").props.onChange({ target: { value: "chilled" } });
    expect(next!.parts[0]!.ingredients[1]!.note).toBe("chilled");

    elementWithLabel(tree, "Ingredient 2 fixed").props.onCheckedChange(true);
    expect(next!.parts[0]!.ingredients[1]!.fixed).toBe(true);

    elementWithLabel(tree, "Ingredient 2 unit").props.onCreate("handful");
    expect(next!.parts[0]!.ingredients[1]!.unit).toMatchObject({ name: "handful" });

    elementWithLabel(tree, "Ingredient 2 food").props.onCreate("butter");
    expect(next!.parts[0]!.ingredients[1]!.food).toMatchObject({ name: "butter" });
    expect(validateDraft(next!).ok).toBe(true);
  });
});

describe("the inline fields on wide (M13.6)", () => {
  test("a parsed row with original text shows it in grey above the fields, unlabelled", () => {
    const draft = updateIngredient(tart(), 0, 0, { originalText: "200g plain flour" });
    const html = renderToString(<IngredientFields {...fieldProps(draft, 0, () => {})} originalTextAbove />);
    expect(html).toMatch(/^<div[^>]*><p[^>]*data-original-text-above=""[^>]*>200g plain flour<\/p>/);
    expect(html).not.toContain("Original text");
  });

  test("no line when there is no original text, or the row is text only", () => {
    const plain = renderToString(<IngredientFields {...fieldProps(tart(), 0, () => {})} originalTextAbove />);
    expect(plain).not.toContain("data-original-text-above");

    const text = updateIngredient(addIngredient(emptyDraft(), 0), 0, 0, { originalText: "a pinch of salt" });
    const html = renderToString(<IngredientFields {...fieldProps(text, 0, () => {})} originalTextAbove />);
    expect(html).not.toContain("data-original-text-above");
  });

  test("without the prop, a parsed row's original text stays out of the inline fields", () => {
    const draft = updateIngredient(tart(), 0, 0, { originalText: "200g plain flour" });
    const html = renderToString(<IngredientFields {...fieldProps(draft, 0, () => {})} />);
    expect(html).not.toContain("data-original-text-above");
    expect(html).not.toContain("200g plain flour");
  });
});

// --- M17.6 Parse a single row ------------------------------------------------
//
// A text-only row's `originalText` gets the same treatment a pasted line
// does (M17.5): parsed, reviewed, and only ever applied once approved. Two
// pure functions carry the logic — `parseRowFor` (parse + wrap as a review
// row) and `parsedRowPatch` (the review's decision as a patch onto the row it
// came from) — so "fills the draft, leaves originalText intact" is checked
// without a DOM. The two placements (row menu inline, plain button in the
// phone sheet) are checked as markup, the same way `SortMenu`/`Menu` are
// (no jsdom in this project's vitest config).

/** A text-only row holding `text` as the sole ingredient of a fresh draft's first component. */
function textOnlyDraft(text: string): RecipeDraft {
  return updateIngredient(addIngredient({ ...emptyDraft(), name: "Toast" }, 0), 0, 0, { originalText: text });
}

describe("parseRowFor", () => {
  test("parses a line the same way bulk add's reviewRows does, for one row", () => {
    const row = parseRowFor("200 g flour, sifted", { units, foods: [flourRow] }, "row-1");
    expect(row).toEqual({ ...reviewOf("200 g flour, sifted"), key: "row-1" });
  });

  test("an unmatched food proposes a name to create, declined by default", () => {
    const row = parseRowFor("100 g almond meal", { units, foods: [flourRow] }, "row-2");
    expect(row.food).toEqual({ kind: "none" });
    expect(row.foodText).toBe("almond meal");
  });
});

describe("parsedRowPatch", () => {
  test("a matched row patches quantity, unit, food and note; originalText is never in it", () => {
    const row = reviewOf("200 g flour, sifted");
    const patch = parsedRowPatch(row, new Map(), new Map());
    expect(patch).toEqual({ quantity: 200, fixed: false, note: "sifted", unit: gram, food: foodReference(flourRow) });
    expect(patch).not.toHaveProperty("originalText");
  });

  test("a declined food leaves nothing to apply", () => {
    const row = reviewOf("100 g almond meal");
    expect(row.food).toEqual({ kind: "none" });
    expect(parsedRowPatch(row, new Map(), new Map())).toBeNull();
  });

  test("an approved creation is taken from the created map, keyed by the approved name", () => {
    const almond = { ...flourRow, id: "22222222-2222-4222-8222-222222222222", name: "Almond Meal" };
    const row = reviewOf("100 g almond meal");
    const approved = { ...row, food: { kind: "create" as const, name: row.foodText } };
    const patch = parsedRowPatch(approved, new Map([["almond meal", almond]]), new Map());
    expect(patch?.food?.id).toBe(almond.id);
  });

  test("an approved creation missing from the map leaves nothing to apply, rather than inventing a reference", () => {
    const row = reviewOf("100 g almond meal");
    const approved = { ...row, food: { kind: "create" as const, name: row.foodText } };
    expect(parsedRowPatch(approved, new Map(), new Map())).toBeNull();
  });

  test("a declined unit still patches a structured row, just with no unit", () => {
    const row = reviewOf("2 sprigs flour");
    expect(row.unitText).toBe("sprigs");
    const patch = parsedRowPatch(row, new Map(), new Map());
    expect(patch).toMatchObject({ quantity: 2, unit: null });
    expect(patch?.food?.name).toBe("flour");
  });
});

describe("Check: parsing a saved row (M17.6)", () => {
  test("a matched parse fills the draft row and leaves originalText intact", () => {
    const draft = textOnlyDraft("200 g flour, sifted");
    const before = draft.parts[0]!.ingredients[0]!;
    const parsed = parseRowFor(before.originalText ?? "", { units, foods: [flourRow] }, before.id ?? "row");
    expect(parsed.food).toEqual({ kind: "existing", row: flourRow });

    const patch = parsedRowPatch(parsed, new Map(), new Map());
    expect(patch).not.toBeNull();
    expect(patch).not.toHaveProperty("originalText");

    const after = updateIngredient(draft, 0, 0, patch!).parts[0]!.ingredients[0]!;
    expect(after.originalText).toBe("200 g flour, sifted");
    expect(after.quantity).toBe(200);
    expect(after.note).toBe("sifted");
    expect(after.unit?.name).toBe("gram");
    expect(after.food?.name).toBe("flour");
    expect(isTextOnly(after)).toBe(false);
  });

  test("declining an unknown food leaves the row exactly as it was", () => {
    const draft = textOnlyDraft("100 g almond meal");
    const before = draft.parts[0]!.ingredients[0]!;
    const parsed = parseRowFor(before.originalText ?? "", { units, foods: [flourRow] }, before.id ?? "row");
    expect(parsed.food).toEqual({ kind: "none" });
    expect(parsedRowPatch(parsed, new Map(), new Map())).toBeNull();
    // Nothing to apply: the row is untouched, still text only.
    expect(draft.parts[0]!.ingredients[0]).toEqual(before);
    expect(isTextOnly(before)).toBe(true);
  });

  test("an approved creation is made only from the confirmed name, and originalText survives it", async () => {
    const draft = textOnlyDraft("100 g almond meal");
    const before = draft.parts[0]!.ingredients[0]!;
    const parsed = parseRowFor(before.originalText ?? "", { units, foods: [] }, before.id ?? "row");
    const approved = { ...parsed, food: { kind: "create" as const, name: parsed.foodText } };
    const pending = pendingCreations([approved]);
    expect(pending).toEqual({ foods: ["almond meal"], units: [] });

    const created = await callServerFn(findOrCreateFood, { name: pending.foods[0]! });
    const patch = parsedRowPatch(approved, new Map([[pending.foods[0]!.toLowerCase(), created]]), new Map());
    const after = updateIngredient(draft, 0, 0, patch!).parts[0]!.ingredients[0]!;
    expect(after.originalText).toBe("100 g almond meal");
    expect(after.food?.name).toBe("almond meal");
    expect(isTextOnly(after)).toBe(false);
  });
});

describe("the Parse action's two placements (M17.6)", () => {
  const noopParse = { review: null, busy: false, error: null, onStart: () => {}, onChange: () => {}, onCancel: () => {}, onConfirm: () => {} };

  test("a text-only row's inline fields (md+) offer Parse inside a row menu", () => {
    const html = renderToString(<IngredientsEditor draft={textOnlyDraft("3 lemons")} pi={0} units={units} onChange={() => {}} />);
    expect(html).toContain('aria-label="Ingredient 1 actions"');
    expect(html).toContain('aria-haspopup="menu"');
  });

  test("a structured row gets no row menu at all", () => {
    const html = renderToString(<IngredientsEditor draft={tart()} pi={0} units={units} onChange={() => {}} />);
    expect(html).not.toContain('aria-label="Ingredient 1 actions"');
    expect(html).not.toContain(">Parse<");
  });

  test("inline (originalTextAbove) renders the trigger as a menu item, not a button", () => {
    const draft = textOnlyDraft("3 lemons");
    const html = renderToString(<IngredientFields {...fieldProps(draft, 0, () => {})} parse={noopParse} originalTextAbove />);
    expect(html).toContain('aria-label="Ingredient 1 actions"');
    expect(html).not.toContain('aria-label="Ingredient 1 parse"');
  });

  test("the phone sheet (showOriginalText) renders the trigger as a plain button", () => {
    const draft = textOnlyDraft("3 lemons");
    const html = renderToString(<IngredientFields {...fieldProps(draft, 0, () => {})} parse={noopParse} showOriginalText />);
    expect(html).toContain('aria-label="Ingredient 1 parse"');
    expect(html).toContain(">Parse<");
    expect(html).not.toContain('aria-label="Ingredient 1 actions"');
  });

  test("a structured row never shows Parse, even if the caller supplies it", () => {
    const html = renderToString(<IngredientFields {...fieldProps(tart(), 0, () => {})} parse={noopParse} showOriginalText />);
    expect(html).not.toContain("Parse");
  });

  test("pressing Parse in the sheet calls onStart", () => {
    const draft = textOnlyDraft("3 lemons");
    let started = false;
    const parse = {
      ...noopParse,
      onStart: () => {
        started = true;
      },
    };
    const tree = IngredientFields({ ...fieldProps(draft, 0, () => {}), parse, showOriginalText: true });
    elementWithLabel(tree, "Ingredient 1 parse").props.onClick();
    expect(started).toBe(true);
  });

  test("once a review is open, Apply and Cancel are plain buttons in both widths", () => {
    const draft = textOnlyDraft("3 lemons");
    const row = parseRowFor("3 lemons", { units, foods: [flourRow] }, "row");
    let confirmed = false;
    let cancelled = false;
    const parse = {
      review: row,
      busy: false,
      error: null,
      onStart: () => {},
      onChange: () => {},
      onCancel: () => {
        cancelled = true;
      },
      onConfirm: () => {
        confirmed = true;
      },
    };
    const tree = IngredientFields({ ...fieldProps(draft, 0, () => {}), parse, originalTextAbove: true });
    elementWithLabel(tree, "Ingredient 1 parse apply").props.onClick();
    expect(confirmed).toBe(true);
    elementWithLabel(tree, "Ingredient 1 parse cancel").props.onClick();
    expect(cancelled).toBe(true);
  });
});

// --- M21.4 keyboard append --------------------------------------------------

describe("Enter on the row's last field (M21.4)", () => {
  /** A one-row draft: a structured row, plus a text-only one when asked. */
  function rows(textOnly = false): RecipeDraft {
    const base = emptyDraft();
    const row = textOnly ? { ...newIngredient(), originalText: "a pinch of salt" } : newIngredient();
    return { ...base, parts: [{ ...base.parts[0]!, ingredients: [row] }] };
  }

  /** Press Enter on the field labelled `label`, returning whether the form's default was prevented. */
  function pressEnter(props: IngredientFieldsProps, label: string, shiftKey = false): boolean {
    const field = elementWithLabel(IngredientFields({ ...props, showOriginalText: false }), label);
    let prevented = false;
    field.props.onKeyDown?.({ key: "Enter", shiftKey, preventDefault: () => (prevented = true) });
    return prevented;
  }

  test("a structured row's note takes Enter, and calls back once", () => {
    let calls = 0;
    const props = { ...fieldProps(rows(), 0, () => {}), onEnter: () => (calls += 1) };
    expect(pressEnter(props, "Ingredient 1 note")).toBe(true);
    expect(calls).toBe(1);
  });

  test("a text-only row's line takes it too", () => {
    let calls = 0;
    const props = { ...fieldProps(rows(true), 0, () => {}), onEnter: () => (calls += 1) };
    expect(pressEnter(props, "Ingredient 1 text")).toBe(true);
    expect(calls).toBe(1);
  });

  test("Shift+Enter is left alone, so the form's own behaviour is untouched", () => {
    let calls = 0;
    const props = { ...fieldProps(rows(), 0, () => {}), onEnter: () => (calls += 1) };
    expect(pressEnter(props, "Ingredient 1 note", true)).toBe(false);
    expect(calls).toBe(0);
  });

  test("no handler at all where the caller gave none", () => {
    const field = elementWithLabel(IngredientFields({ ...fieldProps(rows(), 0, () => {}), showOriginalText: false }), "Ingredient 1 note");
    expect(field.props.onKeyDown).toBeUndefined();
  });

  test("the last row appends and an earlier one moves on", () => {
    // The wiring itself is `rowEnter`, tested in test/lib/rowKeys.test.ts;
    // what matters here is that the editor appends to the right part.
    const draft = rows();
    const next = addIngredient(draft, 0);
    expect(next.parts[0]!.ingredients).toHaveLength(2);
    expect(next.parts[0]!.ingredients[0]).toEqual(draft.parts[0]!.ingredients[0]);
  });
});

// --- A row that leaves a part leaves its step links (M28.3) -----------------

/** The tart, with a step in Pastry linking both of its rows and a step in Filling linking its one. */
function tartWithLinks(): RecipeDraft {
  let draft = addStep(tart(), 0, "Rub the butter into the flour.");
  draft = addStep(draft, 1, "Squeeze the lemon.");
  const [flour, butter] = draft.parts[0]!.ingredients.map((row) => row.id!);
  draft = linkIngredient(draft, 0, 0, flour!);
  draft = linkIngredient(draft, 0, 0, butter!);
  draft = linkIngredient(draft, 1, 0, draft.parts[1]!.ingredients[0]!.id!);
  return draft;
}

const stepLinksOf = (draft: RecipeDraft, pi: number) => draft.parts[pi]!.steps.map((step) => step.ingredientIds ?? []);

describe("removeIngredient and moveIngredientTo clear the row's links (M28.3)", () => {
  test("deleting a row removes it from every step of its part", () => {
    const draft = tartWithLinks();
    const [flour, butter] = draft.parts[0]!.ingredients.map((row) => row.id!);
    const next = removeIngredient(draft, 0, 0);
    expect(next.parts[0]!.ingredients.map((row) => row.id)).toEqual([butter]);
    expect(stepLinksOf(next, 0)).toEqual([[butter]]);
    // The other part is untouched.
    expect(stepLinksOf(next, 1)).toEqual(stepLinksOf(draft, 1));
    expect(flour).not.toBe(butter);
  });

  test("moving a row to another part removes it from the links of the part it left, and adds none in the part it joined", () => {
    const draft = tartWithLinks();
    const [flour, butter] = draft.parts[0]!.ingredients.map((row) => row.id!);
    const lemon = draft.parts[1]!.ingredients[0]!.id!;
    const next = moveIngredient(draft, 0, 0, 1);
    expect(next.parts[1]!.ingredients.map((row) => row.id)).toEqual([lemon, flour]);
    expect(stepLinksOf(next, 0)).toEqual([[butter]]);
    expect(stepLinksOf(next, 1)).toEqual([[lemon]]);
  });

  test("moveIngredientTo at an index does the same", () => {
    const draft = tartWithLinks();
    const [, butter] = draft.parts[0]!.ingredients.map((row) => row.id!);
    const next = moveIngredientTo(draft, 0, 1, 1, 0);
    expect(next.parts[1]!.ingredients[0]!.id).toBe(butter);
    expect(stepLinksOf(next, 0)).toEqual([[draft.parts[0]!.ingredients[0]!.id]]);
  });

  test("a row nothing links leaves the links alone", () => {
    const draft = tartWithLinks();
    const before = stepLinksOf(draft, 1);
    const next = removeIngredient(addIngredient(draft, 1), 1, 1);
    expect(stepLinksOf(next, 1)).toEqual(before);
  });
});
