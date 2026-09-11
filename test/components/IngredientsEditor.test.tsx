// The ingredient editor's pure helpers, its rendering, and the Check for M5.4:
// a component holding a normal row, a row with no quantity and a new food, and
// a text-only row saves through createRecipe and reads back intact, with the
// new food created by name.
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { addComponent, renameComponent } from "../../src/components/ComponentsEditor";
import {
  addBulkIngredients,
  addIngredient,
  EMPTY_INGREDIENT_SUMMARY,
  filterUnits,
  foodReference,
  IngredientFields,
  type IngredientFieldsProps,
  ingredientSummary,
  IngredientsEditor,
  isTextOnly,
  matchUnit,
  moveIngredient,
  moveIngredientTo,
  INGREDIENT_DRAG_GROUP,
  newIngredient,
  parseQuantity,
  quantityText,
  removeIngredient,
  textOnlyPatch,
  unitReference,
  updateIngredient,
} from "../../src/components/IngredientsEditor";
import { type DraftComponent, type DraftIngredient, emptyDraft, type RecipeDraft, validateDraft } from "../../src/components/RecipeForm";
import { listFoods } from "../../src/server/foods";
import { createRecipe, getRecipe } from "../../src/server/recipes";
import { callServerFn, useTempDataDir } from "../helpers/server";

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
  let draft = renameComponent({ ...emptyDraft(), name: "Lemon tart" }, 0, "Pastry");
  draft = addComponent(draft, "Filling");
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
    const ref = foodReference({ id: gram.id, name: "Flour", pluralName: null, aliases: ["plain flour"], aisleId: "aisle-1", recipeId: null, skipShopping: false });
    expect(ref).toEqual({ id: gram.id, name: "Flour", pluralName: null, aliases: ["plain flour"], aisle: null, recipeId: null, skipShopping: false });
  });

  test("a name alone becomes a new reference with defaults and a client uuid", () => {
    const ref = foodReference({ name: "  yeast " });
    expect(ref).toMatchObject({ name: "yeast", pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false });
    expect(ref.id).toMatch(UUID);
    const unit = unitReference(" handful ");
    expect(unit).toMatchObject({ name: "handful", pluralName: null, abbreviation: "", useAbbreviation: false, fraction: true, standardQuantity: null, standardUnitId: null });
    expect(unit.id).toMatch(UUID);
  });

  test("both pass the document schema inside a recipe", () => {
    const draft = updateIngredient(addIngredient({ ...emptyDraft(), name: "Toast" }, 0), 0, 0, { food: foodReference({ name: "bread" }), unit: unitReference("slice") });
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
    const draft = addComponent(emptyDraft(), "Filling");
    const next = addIngredient(draft, 1);
    expect(next.components[0]!.ingredients).toHaveLength(0);
    expect(next.components[1]!.ingredients).toHaveLength(1);
    expect(next.components[1]!.ingredients[0]!.id).toMatch(UUID);
    expect(draft.components[1]!.ingredients).toHaveLength(0);
    expect(next.components[0]).toBe(draft.components[0]);
  });

  test("updateIngredient merges a patch into one row, leaving the rest alone", () => {
    const draft = tart();
    const next = updateIngredient(draft, 0, 1, { note: "chilled", fixed: true });
    expect(next.components[0]!.ingredients[1]).toMatchObject({ quantity: 1, unit: cup, note: "chilled", fixed: true });
    expect(next.components[0]!.ingredients[0]).toBe(draft.components[0]!.ingredients[0]);
    expect(next.components[1]).toBe(draft.components[1]);
    expect(draft.components[0]!.ingredients[1]!.note).toBe("cold");
  });

  test("removeIngredient drops one row", () => {
    const draft = tart();
    const next = removeIngredient(draft, 0, 0);
    expect(next.components[0]!.ingredients.map((r) => r.note)).toEqual(["cold"]);
    expect(draft.components[0]!.ingredients).toHaveLength(2);
  });

  test("out-of-range indices return an unchanged copy", () => {
    const draft = tart();
    for (const next of [addIngredient(draft, 2), updateIngredient(draft, 0, 5, { note: "x" }), updateIngredient(draft, -1, 0, {}), removeIngredient(draft, 1, 1), removeIngredient(draft, 3, 0)]) {
      expect(next.components).toEqual(draft.components);
      expect(next.components).not.toBe(draft.components);
    }
  });
});

describe("moveIngredient", () => {
  test("appends the row to the target component and removes it from the source", () => {
    const draft = tart();
    const moved = draft.components[0]!.ingredients[0]!;
    const next = moveIngredient(draft, 0, 0, 1);
    expect(next.components[0]!.ingredients.map((r) => r.note)).toEqual(["cold"]);
    expect(next.components[1]!.ingredients).toHaveLength(2);
    expect(next.components[1]!.ingredients[1]).toBe(moved);
    expect(draft.components[0]!.ingredients).toHaveLength(2);
    expect(draft.components[1]!.ingredients).toHaveLength(1);
  });

  test("same component or out-of-range indices return an unchanged copy", () => {
    const draft = tart();
    for (const next of [moveIngredient(draft, 0, 0, 0), moveIngredient(draft, 0, 2, 1), moveIngredient(draft, 0, 0, 2), moveIngredient(draft, 5, 0, 1)]) {
      expect(next.components).toEqual(draft.components);
      expect(next.components).not.toBe(draft.components);
    }
  });
});

describe("moveIngredientTo", () => {
  test("a drag drops the row at the index it was released over", () => {
    const draft = tart();
    const moved = draft.components[0]!.ingredients[0]!;
    const next = moveIngredientTo(draft, 0, 0, 1, 0);
    expect(next.components[1]!.ingredients[0]).toBe(moved);
    expect(next.components[1]!.ingredients).toHaveLength(2);
    expect(next.components[0]!.ingredients.map((r) => r.note)).toEqual(["cold"]);
  });

  test("an index past the end appends, and a negative one lands first", () => {
    const draft = tart();
    const moved = draft.components[0]!.ingredients[1]!;
    expect(moveIngredientTo(draft, 0, 1, 1, 99).components[1]!.ingredients[1]).toBe(moved);
    expect(moveIngredientTo(draft, 0, 1, 1, -3).components[1]!.ingredients[0]).toBe(moved);
  });

  test("with no index it appends, which is what the move-to select does", () => {
    const draft = tart();
    expect(moveIngredientTo(draft, 0, 0, 1)).toEqual(moveIngredient(draft, 0, 0, 1));
  });

  test("same component or out-of-range indices return an unchanged copy", () => {
    const draft = tart();
    for (const next of [moveIngredientTo(draft, 0, 0, 0, 0), moveIngredientTo(draft, 0, 9, 1, 0), moveIngredientTo(draft, 0, 0, 7, 0)]) {
      expect(next.components).toEqual(draft.components);
      expect(next.components).not.toBe(draft.components);
    }
  });
});

describe("addBulkIngredients", () => {
  test("appends one text-only row per line, in order, to the named component only", () => {
    const draft = tart();
    const next = addBulkIngredients(draft, 1, ["3 lemons, zested", "a pinch of salt"]);
    expect(next.components[1]!.ingredients).toHaveLength(3);
    expect(next.components[1]!.ingredients[1]).toMatchObject({ originalText: "3 lemons, zested", food: null, quantity: null });
    expect(next.components[1]!.ingredients[2]).toMatchObject({ originalText: "a pinch of salt", food: null, quantity: null });
    expect(next.components[1]!.ingredients.slice(1).every(isTextOnly)).toBe(true);
    expect(next.components[1]!.ingredients[1]!.id).toMatch(UUID);
    expect(next.components[0]).toBe(draft.components[0]);
    // Original untouched.
    expect(draft.components[1]!.ingredients).toHaveLength(1);
  });

  test("no lines, or an out-of-range component, returns an unchanged copy", () => {
    const draft = tart();
    for (const next of [addBulkIngredients(draft, 0, []), addBulkIngredients(draft, 5, ["x"])]) {
      expect(next.components).toEqual(draft.components);
      expect(next.components).not.toBe(draft.components);
    }
  });

  test("the result still validates", () => {
    const draft = addBulkIngredients({ ...emptyDraft(), name: "Toast" }, 0, ["2 eggs", "a pinch of salt"]);
    expect(validateDraft(draft).ok).toBe(true);
  });
});

describe("IngredientsEditor", () => {
  test("has a Bulk add button beside Add ingredient, and the sheet is closed by default", () => {
    const html = renderToString(<IngredientsEditor draft={tart()} ci={0} units={units} onChange={() => {}} />);
    expect(html).toContain(">Bulk add<");
    expect(html).toContain(">Add ingredient<");
    expect(html).not.toContain('role="dialog"');
  });

  test("each row has a drag handle and the list joins the shared drag group", () => {
    const draft = tart();
    const html = renderToString(<IngredientsEditor draft={draft} ci={0} units={units} onChange={() => {}} />);
    expect(html).toContain(`data-reorder-group="${INGREDIENT_DRAG_GROUP}"`);
    expect(html.match(/aria-label="Drag ingredient \d"/g)).toHaveLength(2);
    // The move-to select survives alongside the handle.
    expect(html).toContain("Move to…");
  });


  test("renders the row inputs for a component: quantity, unit, food, note, fixed, text toggle, move-to", () => {
    const draft = tart();
    const html = renderToString(<IngredientsEditor draft={draft} ci={0} units={units} onChange={() => {}} />);
    expect(html).toContain(">Add ingredient<");
    expect(html).not.toContain("No ingredients yet");
    expect(tagWithLabel(html, "Ingredient 1 quantity")).toContain('value="200"');
    expect(tagWithLabel(html, "Ingredient 1 quantity")).toContain('name="components.0.ingredients.0.quantity"');
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
    expect(html).toContain('aria-label="Move ingredient 1 to component"');
    expect(html).toContain("Move to…");
    // Reorder and remove controls per row; the food list does not query on the server.
    expect(html.match(/aria-label="Move ingredient \d up"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Remove ingredient \d"/g)).toHaveLength(2);
    expect(html).not.toContain('role="listbox"');
  });

  test("a text-only row shows one text input and no amount fields", () => {
    const draft = updateIngredient(addIngredient({ ...emptyDraft(), name: "Toast" }, 0), 0, 0, { originalText: "a pinch of salt" });
    const html = renderToString(<IngredientsEditor draft={draft} ci={0} units={units} onChange={() => {}} />);
    expect(tagWithLabel(html, "Ingredient 1 text")).toContain('value="a pinch of salt"');
    expect(tagWithLabel(html, "Ingredient 1 text")).toContain('name="components.0.ingredients.0.originalText"');
    expect(tagWithLabel(html, "Ingredient 1 text only")).toContain('aria-pressed="true"');
    expect(html).not.toContain("Ingredient 1 quantity");
    expect(html).not.toContain("Ingredient 1 food");
    // A sole component has nowhere to move to.
    expect(html).not.toContain("Move to…");
  });

  test("an empty component says so; disabled disables the inputs and the add button; a quantity error shows on its row", () => {
    const empty = renderToString(<IngredientsEditor draft={emptyDraft()} ci={0} units={units} onChange={() => {}} />);
    expect(empty).toContain("No ingredients yet");

    const html = renderToString(
      <IngredientsEditor draft={tart()} ci={0} units={units} onChange={() => {}} disabled errors={{ "components.0.ingredients.1.quantity": "Too small" }} />,
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
    expect(renderToString(<IngredientsEditor draft={emptyDraft()} ci={3} units={units} onChange={() => {}} />)).toBe("");
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
    const rows = (draft.components[0] as DraftComponent).ingredients;
    expect(rows.map(isTextOnly)).toEqual([false, false, true]);

    const parsed = validateDraft(draft);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const created = await callServerFn(createRecipe, parsed.data);
    const fetched = await callServerFn(getRecipe, { slug: created.slug });
    expect(fetched).toEqual(created);
    const [bread, butter, salt] = fetched.components[0]!.ingredients;
    expect(fetched.components[0]!.ingredients).toHaveLength(3);

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
    let draft = addComponent({ ...emptyDraft(), name: "Two part" }, "Sauce");
    draft = addIngredient(draft, 0);
    draft = updateIngredient(draft, 0, 0, { quantity: 1, food: foodReference({ name: "onion" }) });
    draft = moveIngredient(draft, 0, 0, 1);
    const parsed = validateDraft(draft);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const created = await callServerFn(createRecipe, parsed.data);
    const fetched = await callServerFn(getRecipe, { slug: created.slug });
    expect(fetched.components[0]!.ingredients).toEqual([]);
    expect(fetched.components[1]!.ingredients).toHaveLength(1);
    expect(fetched.components[1]!.ingredients[0]!.food).toMatchObject({ name: "onion" });
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

/** The props `IngredientRow` hands `IngredientFields`, for row `ii` of component 0. */
function fieldProps(draft: RecipeDraft, ii: number, onPatch: (patch: Partial<DraftIngredient>) => void): IngredientFieldsProps {
  const ingredient = draft.components[0]!.ingredients[ii]!;
  return {
    ingredient,
    path: `components.0.ingredients.${ii}`,
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
    expect(ingredientSummary(draft.components[0]!.ingredients[0]!)).toBe("200 g flour");
    expect(ingredientSummary(draft.components[0]!.ingredients[1]!)).toBe("1 cup, cold");
    expect(ingredientSummary(draft.components[1]!.ingredients[0]!)).toBe("3 lemon");
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
    const html = renderToString(<IngredientsEditor draft={tart()} ci={0} units={units} onChange={() => {}} />);

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
    const blank = renderToString(<IngredientsEditor draft={addIngredient(emptyDraft(), 0)} ci={0} units={units} onChange={() => {}} />);
    expect(blank).toContain(`>${EMPTY_INGREDIENT_SUMMARY}<`);

    const text = updateIngredient(addIngredient(emptyDraft(), 0), 0, 0, { originalText: "a pinch of salt" });
    const html = renderToString(<IngredientsEditor draft={text} ci={0} units={units} onChange={() => {}} />);
    const summary = html.match(/<button[^>]*aria-label="Edit ingredient 1"[^>]*>/)?.[0] ?? "";
    expect(summary).toContain("md:hidden");
    expect(html).toContain(">a pinch of salt<");
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
    expect(html).not.toContain('name="components.0.ingredients.0.originalText"');
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
    const tree = IngredientFields({ ...fieldProps(draft, 1, (patch) => { next = updateIngredient(draft, 0, 1, patch); }), showOriginalText: true });

    elementWithLabel(tree, "Ingredient 2 quantity").props.onChange({ target: { value: "1 1/2" } });
    expect(next!.components[0]!.ingredients[1]!.quantity).toBe(1.5);
    expect(draft.components[0]!.ingredients[1]!.quantity).toBe(1);

    elementWithLabel(tree, "Ingredient 2 note").props.onChange({ target: { value: "chilled" } });
    expect(next!.components[0]!.ingredients[1]!.note).toBe("chilled");

    elementWithLabel(tree, "Ingredient 2 fixed").props.onCheckedChange(true);
    expect(next!.components[0]!.ingredients[1]!.fixed).toBe(true);

    elementWithLabel(tree, "Ingredient 2 unit").props.onCreate("handful");
    expect(next!.components[0]!.ingredients[1]!.unit).toMatchObject({ name: "handful" });

    elementWithLabel(tree, "Ingredient 2 food").props.onCreate("butter");
    expect(next!.components[0]!.ingredients[1]!.food).toMatchObject({ name: "butter" });
    expect(validateDraft(next!).ok).toBe(true);
  });
});
