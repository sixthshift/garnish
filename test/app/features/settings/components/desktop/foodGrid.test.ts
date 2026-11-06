// The foods grid's cell text: aliases as a cell types them, and a food's sizes and conversions as one line.
import { expect, test } from "vitest";
import { conversionsText, packsText, parseAliasList } from "../../../../../../src/app/features/settings/components/desktop/foodGrid";
import type { Unit } from "../../../../../../src/domain/recipes/reference";

const unit = (id: string, name: string, abbreviation = ""): Unit => ({
  id,
  name,
  pluralName: null,
  abbreviation,
  useAbbreviation: false,
  fraction: true,
  portion: false,
  standardQuantity: null,
  standardUnitId: null,
});
const units = [unit("u-g", "gram", "g"), unit("u-cup", "cup")];

test("aliases part on commas, trimmed, with blanks and repeats (ignoring case) dropped", () => {
  expect(parseAliasList(" plain flour, , all-purpose flour,Plain Flour ")).toEqual(["plain flour", "all-purpose flour"]);
  expect(parseAliasList("")).toEqual([]);
});

test("sizes read smallest first, in the unit's short name, or each", () => {
  expect(
    packsText(
      [
        { id: "p1", foodId: "f", quantity: 500, unitId: "u-g" },
        { id: "p2", foodId: "f", quantity: 250, unitId: "u-g" },
        { id: "p3", foodId: "f", quantity: 6, unitId: null },
      ],
      units
    )
  ).toBe("6 each, 250 g, 500 g");
  expect(packsText([], units)).toBe("");
});

test("conversions read as equations", () => {
  expect(conversionsText([{ id: "c1", unitId: "u-cup", quantity: 1, toUnitId: "u-g", toQuantity: 125 }], units)).toBe("1 cup = 125 g");
});
