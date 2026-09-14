// The review step's pure decisions (M17.5): what a parsed line proposes, what
// a reviewer's choice commits, and what Confirm is allowed to create. The
// point of the whole step is the last one — declining a proposal must create
// nothing — so most of this file is about the "none" choice.
import { describe, expect, test } from "vitest";
import {
  pendingCreations,
  reviewCount,
  reviewRow,
  reviewRows,
  rowCommit,
  rowStatus,
  setRowFood,
  setRowUnit,
} from "../../../src/domain/ingredient/bulkIngredients";
import { parseIngredient } from "../../../src/domain/ingredient/parseIngredient";

const gram = { name: "gram", pluralName: "grams", abbreviation: "g" };
const cup = { name: "cup", pluralName: "cups", abbreviation: "" };
const units = [gram, cup];

const flour = { name: "flour", pluralName: null, aliases: [] };
const rosemary = { name: "rosemary", pluralName: null, aliases: [] };
const foods = [flour, rosemary];

const vocabulary = { units, foods };

function review(line: string) {
  return reviewRow(parseIngredient(line, vocabulary), "0");
}

describe("reviewRow", () => {
  test("a fully matched line carries both rows and proposes nothing", () => {
    const row = review("200 g flour, sifted");
    expect(row).toMatchObject({ quantity: 200, fixed: false, note: "sifted", unitText: "", foodText: "", originalText: "200 g flour, sifted" });
    expect(row.unit).toEqual({ kind: "existing", row: gram });
    expect(row.food).toEqual({ kind: "existing", row: flour });
    expect(rowStatus(row)).toBe("matched");
  });

  test("an unknown food is proposed, not chosen", () => {
    const row = review("100 g almond meal");
    expect(row.food).toEqual({ kind: "none" });
    expect(row.foodText).toBe("almond meal");
    expect(rowStatus(row)).toBe("review");
  });

  test("the parser's unit backtrack becomes a unit proposal, still declined", () => {
    const row = review("2 sprigs rosemary");
    expect(row.unit).toEqual({ kind: "none" });
    expect(row.unitText).toBe("sprigs");
    expect(row.food).toEqual({ kind: "existing", row: rosemary });
    expect(rowStatus(row)).toBe("review");
  });

  test("a line with nothing left to resolve reads as text only", () => {
    const row = review("1 cup");
    expect(row.foodText).toBe("");
    expect(row.unit).toEqual({ kind: "existing", row: cup });
    expect(rowStatus(row)).toBe("text");
  });

  test("a fixed amount keeps its flag and the raw line", () => {
    const row = review("=1 cup flour");
    expect(row.fixed).toBe(true);
    expect(row.originalText).toBe("=1 cup flour");
  });
});

describe("reviewRows", () => {
  test("one row per line, in order, keyed by position", () => {
    const rows = reviewRows(["200 g flour", "100 g almond meal"], vocabulary);
    expect(rows.map((row) => row.key)).toEqual(["0", "1"]);
    expect(rows.map(rowStatus)).toEqual(["matched", "review"]);
    expect(reviewCount(rows)).toBe(1);
  });
});

describe("setRowFood / setRowUnit", () => {
  test("replace one row's choice and leave the rest alone", () => {
    const rows = reviewRows(["100 g almond meal", "2 sprigs rosemary"], vocabulary);
    const withFood = setRowFood(rows, "0", { kind: "create", name: "almond meal" });
    expect(withFood[0]!.food).toEqual({ kind: "create", name: "almond meal" });
    expect(withFood[1]).toEqual(rows[1]);
    const withUnit = setRowUnit(withFood, "1", { kind: "existing", row: cup });
    expect(withUnit[1]!.unit).toEqual({ kind: "existing", row: cup });
    expect(withUnit[0]).toEqual(withFood[0]);
    // The originals are untouched.
    expect(rows[0]!.food).toEqual({ kind: "none" });
  });

  test("an unknown key changes nothing", () => {
    const rows = reviewRows(["200 g flour"], vocabulary);
    expect(setRowFood(rows, "9", { kind: "none" })).toEqual(rows);
  });
});

describe("rowCommit", () => {
  test("a matched row commits everything the line held", () => {
    expect(rowCommit(review("200 g flour, sifted"))).toEqual({
      textOnly: false,
      originalText: "200 g flour, sifted",
      quantity: 200,
      fixed: false,
      note: "sifted",
      unit: { kind: "existing", row: gram },
      food: { kind: "existing", row: flour },
    });
  });

  test("a declined food commits a text-only row: the raw line and nothing else", () => {
    expect(rowCommit(review("100 g almond meal"))).toEqual({
      textOnly: true,
      originalText: "100 g almond meal",
      quantity: null,
      fixed: false,
      note: "",
      unit: null,
      food: null,
    });
  });

  test("an approved food commits a create by name, with the amount and note kept", () => {
    const row = review("100 g almond meal, blanched");
    const commit = rowCommit({ ...row, food: { kind: "create", name: row.foodText } });
    expect(commit).toMatchObject({ textOnly: false, quantity: 100, note: "blanched", food: { kind: "create", name: "almond meal" } });
  });

  test("a blank create name is the same as declining", () => {
    const row = review("100 g almond meal");
    expect(rowCommit({ ...row, food: { kind: "create", name: "  " } }).textOnly).toBe(true);
  });

  test("a declined unit only drops the unit; the row stays structured", () => {
    const commit = rowCommit(review("2 sprigs rosemary"));
    expect(commit).toMatchObject({ textOnly: false, quantity: 2, unit: null, food: { kind: "existing", row: rosemary } });
  });
});

describe("pendingCreations", () => {
  test("nothing is created from a paste nobody touched", () => {
    const rows = reviewRows(["200 g flour", "100 g almond meal", "2 sprigs rosemary"], vocabulary);
    expect(pendingCreations(rows)).toEqual({ foods: [], units: [] });
  });

  test("only approved names, once each, compared case-insensitively", () => {
    let rows = reviewRows(["100 g almond meal", "200 g Almond Meal", "2 sprigs rosemary"], vocabulary);
    rows = setRowFood(rows, "0", { kind: "create", name: "almond meal" });
    rows = setRowFood(rows, "1", { kind: "create", name: "Almond Meal" });
    rows = setRowUnit(rows, "2", { kind: "create", name: "sprig" });
    expect(pendingCreations(rows)).toEqual({ foods: ["almond meal"], units: ["sprig"] });
  });

  test("a unit approved on a row whose food was declined is not created either", () => {
    let rows = reviewRows(["2 sprigs pixie dust"], vocabulary);
    rows = setRowUnit(rows, "0", { kind: "create", name: "sprig" });
    expect(rows[0]!.food).toEqual({ kind: "none" });
    expect(pendingCreations(rows)).toEqual({ foods: [], units: [] });
  });
});
