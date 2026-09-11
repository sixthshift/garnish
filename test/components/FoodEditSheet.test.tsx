// The Foods tab's editor sheet: alias text <-> array conversion, and the form
// FoodEditSheetContent renders.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { aliasesText, FoodEditSheetContent, parseAliases } from "../../src/components/FoodEditSheet";
import type { Food } from "../../src/db/foods";
import type { Aisle } from "../../src/domain/recipe";

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

describe("FoodEditSheetContent render", () => {
  const render = (food: Food, aisles: readonly Aisle[] = [dairy, bakery], busy = false) =>
    renderToString(<FoodEditSheetContent food={food} aisles={aisles} busy={busy} onSave={() => {}} onCancel={() => {}} onCreateAisle={() => Promise.resolve(dairy)} />);

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
