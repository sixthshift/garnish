// Paste into an open recipe (M19.3). Static render only (no jsdom in this
// project's vitest config), so the commit is checked through the pure helper
// and the chrome through `renderToString`.
//
// The Check the task asks for is here: a mixed block lands its ingredients and
// its steps in the right part, after what was already there.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { addPastedToPart, PastePartSheet, PastePartSheetContent } from "../../src/components/PastePartSheet";
import { isTextOnly, newIngredient } from "../../src/components/IngredientsEditor";
import { emptyDraft, type RecipeDraft } from "../../src/components/RecipeForm";
import { newStep } from "../../src/components/StepsEditor";
import { newPart } from "../../src/components/PartsEditor";
import { reviewRows, rowCommit } from "../../src/domain/bulkIngredients";
import { splitRecipe } from "../../src/domain/splitRecipe";
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
const flour: FoodRow = { id: "11111111-1111-4111-8111-111111111111", name: "flour", pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false };
const foods = [flour];

const BLOCK = `Ingredients
200 g flour
100 g almond meal

Method
Mix them.
Bake them.`;

/** A two-part draft whose second part already holds a row of each kind. */
function draft(): RecipeDraft {
  const base = emptyDraft();
  const second = newPart("Filling");
  second.ingredients = [{ ...newIngredient(), originalText: "a pinch of salt" }];
  second.steps = [newStep("Set the oven going.")];
  return { ...base, parts: [base.parts[0]!, second] };
}

/** `BLOCK` split, parsed and committed with nothing approved — the default. */
function pasted() {
  const split = splitRecipe(BLOCK);
  return { commits: reviewRows(split.ingredients, { units, foods }).map(rowCommit), steps: split.steps };
}

describe("addPastedToPart", () => {
  test("both lists land in the named part, after what was there", () => {
    const { commits, steps } = pasted();
    const next = addPastedToPart(draft(), 1, commits, steps, new Map(), new Map());
    const part = next.parts[1]!;
    expect(part.ingredients).toHaveLength(3);
    expect(part.ingredients[0]!.originalText).toBe("a pinch of salt");
    expect(part.ingredients[1]!.food?.name).toBe("flour");
    expect(part.ingredients[1]!.quantity).toBe(200);
    expect(part.ingredients[1]!.unit?.name).toBe("gram");
    // The unknown food was declined by default, so that row stays text only.
    expect(isTextOnly(part.ingredients[2]!)).toBe(true);
    expect(part.ingredients[2]!.originalText).toBe("100 g almond meal");
    expect(part.steps.map((step) => step.text)).toEqual(["Set the oven going.", "Mix them.", "Bake them."]);
  });

  test("the other parts are untouched", () => {
    const { commits, steps } = pasted();
    const before = draft();
    const next = addPastedToPart(before, 1, commits, steps, new Map(), new Map());
    expect(next.parts[0]).toEqual(before.parts[0]);
  });

  test("an out-of-range part changes nothing", () => {
    const { commits, steps } = pasted();
    const before = draft();
    const next = addPastedToPart(before, 7, commits, steps, new Map(), new Map());
    expect(next.parts).toEqual(before.parts);
  });

  test("an approved food reaches the row once it has been created", () => {
    const almond: FoodRow = { ...flour, id: "22222222-2222-4222-8222-222222222222", name: "almond meal" };
    const split = splitRecipe(BLOCK);
    const approved = reviewRows(split.ingredients, { units, foods }).map((row) =>
      row.foodText === "" ? row : { ...row, food: { kind: "create" as const, name: row.foodText } },
    );
    const next = addPastedToPart(draft(), 1, approved.map(rowCommit), split.steps, new Map([["almond meal", almond]]), new Map());
    expect(next.parts[1]!.ingredients[2]!.food?.name).toBe("almond meal");
  });
});

describe("PastePartSheetContent", () => {
  // The design system's Sheet mounts through a portal and renders nothing to a
  // string, so the body is rendered directly — as FoodEditSheet's tests do.
  const props = {
    steps: [] as string[],
    units,
    onTextChange: () => {},
    onContinue: () => {},
    onRowsChange: () => {},
    onBack: () => {},
    onAdd: () => {},
  };

  test("opens on the paste box, with the sheet's own way out rather than a second one", () => {
    const html = renderToString(<PastePartSheetContent {...props} text="" rows={null} />);
    expect(html).toContain('data-import-stage="paste"');
    expect(html).toContain('aria-label="Pasted recipe"');
    expect(html).toContain("Continue");
    expect(html).not.toContain("Start blank");
    expect(html).toContain("land in this part");
  });

  test("the review stage shows the rows and the steps, and no name field", () => {
    const split = splitRecipe(BLOCK);
    const html = renderToString(
      <PastePartSheetContent {...props} text={BLOCK} steps={split.steps} rows={reviewRows(split.ingredients, { units, foods })} />,
    );
    expect(html).toContain('data-import-stage="review"');
    expect(html).toContain("Read as 2 ingredients and 2 steps");
    expect(html.match(/data-review-row=""/g)).toHaveLength(2);
    expect(html).toContain("Mix them.");
    expect(html).toContain(">Add<");
    expect(html).not.toMatch(/<input[^>]*name="name"/);
  });

  test("an error is announced on the paste stage", () => {
    const html = renderToString(<PastePartSheetContent {...props} text="" rows={null} error="Could not reach the server" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Could not reach the server");
  });
});

describe("PastePartSheet", () => {
  // The Sheet mounts by calling `show()` from a layout effect, which never
  // runs on the server, so it renders to nothing either way. Both states are
  // asserted so the split above stays the thing under test.
  test("renders nothing to a string, open or closed", () => {
    const sheet = (open: boolean) => (
      <PastePartSheet open={open} onOpenChange={() => {}} draft={draft()} pi={0} units={units} onChange={() => {}} loadFoods={async () => foods} />
    );
    expect(renderToString(sheet(false))).toBe("");
    expect(renderToString(sheet(true))).toBe("");
  });
});
