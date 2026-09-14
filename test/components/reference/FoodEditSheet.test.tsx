// The Foods tab's editor sheet: alias text <-> array conversion, and the form
// FoodEditSheetContent renders.
import { renderToString } from "react-dom/server";
import { describe, expect, expectTypeOf, test } from "vitest";
import {
  aliasesText,
  blankConversion,
  conversionDraft,
  FoodEditSheetContent,
  isBlankConversion,
  parseAliases,
  parseConversions,
  type ConversionDraft,
  type FoodPatch,
} from "../../../src/components/reference/FoodEditSheet";
import type { Food } from "../../../src/db/models/food/repo";
import type { Unit } from "../../../src/db/models/unit/repo";
import type { Aisle } from "../../../src/domain/recipe/recipe";

const dairy: Aisle = { id: "a1", name: "Dairy", position: 0 };
const bakery: Aisle = { id: "a2", name: "Bakery", position: 1 };

const butter: Food = {
  id: "f1",
  name: "Butter",
  pluralName: null,
  aliases: ["unsalted butter", "salted butter"],
  aisleId: dairy.id,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};

describe("parseAliases", () => {
  test("splits on newlines, trims each line and drops blanks", () => {
    expect(parseAliases("  ghee \n\nunsalted butter\n  ")).toEqual(["ghee", "unsalted butter"]);
    expect(parseAliases("")).toEqual([]);
    expect(parseAliases("\n\n")).toEqual([]);
  });
});

describe("aliasesText", () => {
  test("joins with newlines, and round-trips through parseAliases", () => {
    expect(aliasesText(["ghee", "clarified butter"])).toBe("ghee\nclarified butter");
    expect(aliasesText([])).toBe("");
    expect(parseAliases(aliasesText(butter.aliases))).toEqual(butter.aliases);
  });
});

const unit = (id: string, name: string): Unit => ({
  id,
  name,
  pluralName: null,
  abbreviation: "",
  useAbbreviation: false,
  fraction: true,
  standardQuantity: null,
  standardUnitId: null,
});

const cup = unit("u1", "cup");
const gram = unit("u2", "gram");

const draft = (patch: Partial<ConversionDraft> = {}): ConversionDraft => ({
  key: "k1",
  quantity: "1",
  unitId: cup.id,
  toQuantity: "125",
  toUnitId: gram.id,
  ...patch,
});

describe("parseConversions", () => {
  test("a filled row becomes a conversion, amounts as numbers", () => {
    expect(parseConversions([draft()])).toEqual({
      conversions: [{ unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 125 }],
      error: null,
    });
    expect(parseConversions([draft({ quantity: " 0.5 ", toQuantity: "62.5" })]).conversions).toEqual([
      { unitId: cup.id, quantity: 0.5, toUnitId: gram.id, toQuantity: 62.5 },
    ]);
  });

  test("a blank row is dropped, not refused", () => {
    expect(isBlankConversion(blankConversion())).toBe(true);
    expect(parseConversions([blankConversion(), draft()]).conversions).toHaveLength(1);
    expect(parseConversions([blankConversion()])).toEqual({ conversions: [], error: null });
    expect(parseConversions([])).toEqual({ conversions: [], error: null });
  });

  test("a half-filled row, a bad amount, one unit twice and a repeated pair are each refused", () => {
    expect(parseConversions([draft({ toUnitId: "" })]).error).toMatch(/two amounts and two units/);
    expect(parseConversions([draft({ quantity: "" })]).error).toMatch(/two amounts and two units/);
    expect(parseConversions([draft({ toQuantity: "0" })]).error).toMatch(/above zero/);
    expect(parseConversions([draft({ quantity: "-1" })]).error).toMatch(/above zero/);
    expect(parseConversions([draft({ quantity: "heaps" })]).error).toMatch(/above zero/);
    expect(parseConversions([draft({ toUnitId: cup.id })]).error).toMatch(/two different units/);
    expect(parseConversions([draft(), draft({ key: "k2", toQuantity: "120" })]).error).toMatch(/more than one conversion/);
    // The same units the other way round is a different conversion.
    expect(parseConversions([draft(), draft({ key: "k2", unitId: gram.id, toUnitId: cup.id })]).conversions).toHaveLength(2);
    // Nothing is saved from a bad set.
    expect(parseConversions([draft(), draft({ key: "k2", quantity: "" })]).conversions).toEqual([]);
  });

  test("conversionDraft round-trips a stored conversion", () => {
    const stored = { id: "c1", unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 125 };
    expect(conversionDraft(stored)).toEqual({ key: "c1", quantity: "1", unitId: cup.id, toQuantity: "125", toUnitId: gram.id });
    expect(parseConversions([conversionDraft(stored)]).conversions).toEqual([
      { unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 125 },
    ]);
  });
});

describe("FoodEditSheetContent render", () => {
  const render = (food: Food, aisles: readonly Aisle[] = [dairy, bakery], busy = false, units: readonly Unit[] = [cup, gram]) =>
    renderToString(
      <FoodEditSheetContent food={food} aisles={aisles} units={units} busy={busy} onSave={() => {}} onCancel={() => {}} onCreateAisle={() => Promise.resolve(dairy)} />,
    );

  test("shows the food's current values: name, plural, aisle and aliases", () => {
    const html = render(butter);
    expect(html).toContain("Edit Butter");
    expect(html).toContain('value="Butter"');
    expect(html).toContain('value="Dairy"');
    expect(html).toContain("unsalted butter\nsalted butter");
    expect(html).toContain("Skip shopping");
    expect(html).toContain(">Save<");
    expect(html).toContain(">Cancel<");
  });

  test("no aisle shows blank, and a null plural shows blank", () => {
    const html = render({ ...butter, aisleId: null, pluralName: null });
    expect(html).not.toContain('value="Dairy"');
  });

  test("busy disables the form and Save reads Saving…", () => {
    const html = render(butter, [dairy, bakery], true);
    expect(html).toContain("Saving…");
    expect(html.match(/disabled/g)?.length).toBeGreaterThan(0);
  });
});

describe("the conversions editor", () => {
  const render = (food: Food, units: readonly Unit[] = [cup, gram]) =>
    renderToString(
      <FoodEditSheetContent food={food} aisles={[dairy]} units={units} onSave={() => {}} onCancel={() => {}} onCreateAisle={() => Promise.resolve(dairy)} />,
    );

  const flour: Food = {
    ...butter,
    name: "Plain flour",
    conversions: [{ id: "c1", unitId: cup.id, quantity: 1, toUnitId: gram.id, toQuantity: 125 }],
  };

  test("a stored conversion renders as a row of amount, unit, equals, amount, unit", () => {
    const html = render(flour);
    expect(html).toContain("Conversions");
    expect(html).toContain("1 cup of flour is 125 g");
    expect(html).toContain('value="1"');
    expect(html).toContain('value="125"');
    expect(html).toContain("Conversion 1 amount");
    expect(html).toContain("Conversion 1 unit");
    expect(html).toContain("Conversion 1 equals amount");
    expect(html).toContain("Conversion 1 equals unit");
    expect(html).toContain("Remove conversion 1");
    expect(html).toContain("Add conversion");
  });

  test("a food with none says so, and still offers Add conversion", () => {
    const html = render(butter);
    expect(html).toContain("No conversions.");
    expect(html).not.toContain("Conversion 1 amount");
    expect(html).toContain("Add conversion");
  });

  test("with no units there is nothing to convert between, so the editor asks for one", () => {
    const html = render(flour, []);
    expect(html).toContain("Add a unit first.");
    expect(html).not.toContain("Add conversion");
  });
});

describe("made by a recipe", () => {
  const recipes = [
    { id: "r1", name: "Sweet pastry" },
    { id: "r2", name: "Hollandaise" },
  ];
  const render = (food: Food, list: readonly { id: string; name: string }[] = recipes) =>
    renderToString(
      <FoodEditSheetContent
        food={food}
        aisles={[dairy]}
        recipes={list}
        onSave={() => {}}
        onCancel={() => {}}
        onCreateAisle={() => Promise.resolve(dairy)}
      />,
    );

  test("the field offers the recipes and starts blank for an ordinary food", () => {
    const html = render(butter);
    expect(html).toContain("Made by a recipe");
    expect(html).toContain('aria-label="Made by a recipe"');
    expect(html).not.toContain('value="Sweet pastry"');
  });

  test("a linked food shows its recipe's name", () => {
    const html = render({ ...butter, name: "Pastry", recipeId: "r1" });
    expect(html).toContain('value="Sweet pastry"');
  });

  test("with no recipes to pick from, the field is not offered", () => {
    expect(render(butter, [])).not.toContain("Made by a recipe");
  });

  test("the patch carries recipeId", () => {
    expectTypeOf<FoodPatch["recipeId"]>().toEqualTypeOf<string | null>();
  });
});
