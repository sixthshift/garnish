// Rounding a line up to the sizes its food is sold in (decisions.md row 184).
import { describe, expect, test } from "vitest";
import { foodSchema, type Unit, unitSchema } from "../../../src/domain/reference";
import { overLabel, type PackSize, packsFor, packsLabel } from "../../../src/domain/shopping/packs";

const unit = (id: string, name: string, abbreviation: string, more: Partial<Unit> = {}): Unit =>
  unitSchema.parse({ id, name, pluralName: `${name}s`, abbreviation, useAbbreviation: abbreviation !== "", ...more });

const gram = unit("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "gram", "g");
const ml = unit("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "millilitre", "ml");
const litre = unit("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "litre", "l", { standardQuantity: 1000, standardUnitId: ml.id });
const tbsp = unit("dddddddd-dddd-4ddd-8ddd-dddddddddddd", "tablespoon", "tbsp");
const can = unit("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "can", "");

const food = (name: string, conversions: unknown[] = []) => foodSchema.parse({ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", name, conversions });
const butter = food("butter");
const cream = food("cream");
const stock = food("stock");
const lemon = food("lemon");
const paste = food("tomato paste");

const size = (quantity: number, u: Unit | null): PackSize => ({ quantity, unit: u });
const plan = (quantity: number | null, u: Unit | null, f: typeof butter | null, sizes: PackSize[]) => packsFor({ quantity, unit: u, food: f }, sizes);
const said = (p: ReturnType<typeof packsFor>) => (p === null ? null : packsLabel(p));

describe("packsFor", () => {
  test("one size: as many as cover the need", () => {
    expect(said(plan(150, gram, butter, [size(250, gram)]))).toBe("1 × 250 g");
    expect(said(plan(400, gram, butter, [size(250, gram)]))).toBe("2 × 250 g");
    expect(said(plan(500, gram, butter, [size(250, gram)]))).toBe("2 × 250 g");
  });

  test("several sizes: least over, then fewest packs", () => {
    const sizes = [size(300, ml), size(600, ml)];
    expect(said(plan(450, ml, cream, sizes))).toBe("1 × 600 ml"); // 2 × 300 leaves as much over, in more packs
    expect(said(plan(850, ml, cream, sizes))).toBe("1 × 600 ml + 1 × 300 ml");
    expect(said(plan(250, ml, cream, sizes))).toBe("1 × 300 ml");
    expect(said(plan(1200, ml, cream, sizes))).toBe("2 × 600 ml");
  });

  test("a size in another unit is reached through the unit's standard and the food's conversions", () => {
    expect(said(plan(1500, ml, stock, [size(1, litre)]))).toBe("2 l");
    const convertible = food("tomato paste", [{ id: "11111111-1111-4111-8111-111111111111", unitId: tbsp.id, quantity: 1, toUnitId: gram.id, toQuantity: 16 }]);
    expect(said(plan(2, tbsp, convertible, [size(140, gram)]))).toBe("1 × 140 g");
  });

  test("no plan when no size can be reached, or there is nothing to round", () => {
    expect(plan(2, tbsp, paste, [size(140, gram)])).toBeNull();
    expect(plan(null, gram, butter, [size(250, gram)])).toBeNull();
    expect(plan(150, gram, null, [size(250, gram)])).toBeNull();
    expect(plan(150, gram, butter, [])).toBeNull();
    expect(plan(1, null, lemon, [size(250, gram)])).toBeNull();
  });

  test("each: a size counted in the food itself", () => {
    expect(said(plan(0.5, null, lemon, [size(1, null)]))).toBe("1");
    expect(said(plan(8, null, lemon, [size(6, null), size(12, null)]))).toBe("1 × 12");
  });

  test("a size of one unit is counted in that unit", () => {
    expect(said(plan(1.5, can, food("chickpeas"), [size(1, can), size(400, gram)]))).toBe("2 cans");
  });

  test("a tiny size beside a sensible one is not searched pack by pack", () => {
    expect(said(plan(5000, gram, butter, [size(1, gram), size(500, gram)]))).toBe("10 × 500 g");
  });
});

describe("overLabel", () => {
  test("what is left over in the line's unit, and nothing when the packs fit", () => {
    expect(overLabel(plan(150, gram, butter, [size(250, gram)])!, gram)).toBe("100 g over");
    expect(overLabel(plan(500, gram, butter, [size(250, gram)])!, gram)).toBe("");
    expect(overLabel(plan(0.5, null, lemon, [size(1, null)])!, null)).toBe("0.5 over");
  });
});
