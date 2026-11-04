// A line's alternatives as they are typed (decisions.md row 199): what Done takes from them.
import { expect, test } from "vitest";
import {
  type AlternativeDraft,
  alternativeDraft,
  blankAlternative,
  NO_UNIT,
  parseAlternatives,
} from "../../../../../src/domain/recipes/components/editor/alternativeDraft";

const draft = (over: Partial<AlternativeDraft> = {}): AlternativeDraft => ({
  key: "a",
  basisQuantity: "",
  basisUnitId: NO_UNIT,
  note: "",
  planPicks: false,
  items: [{ key: "i", quantity: "", unitId: NO_UNIT, food: "yoghurt" }],
  ...over,
});

test("a blank amount is none, a blank 'per' is a straight swap, and the note is trimmed", () => {
  expect(parseAlternatives([draft({ note: "  thicker  ", planPicks: true })])).toEqual({
    alternatives: [{ basisQuantity: null, basisUnitId: null, note: "thicker", planPicks: true, items: [{ quantity: null, unitId: null, food: "yoghurt" }] }],
    error: null,
  });
});

test("a new item starts on the line's unit; an item with no food is dropped, and an alternative left with none goes with it", () => {
  expect(blankAlternative("gram").items[0]!.unitId).toBe("gram");
  expect(parseAlternatives([blankAlternative()])).toEqual({ alternatives: [], error: null });
  const two = draft({
    items: [
      { key: "a", quantity: "1", unitId: "cup", food: "milk" },
      { key: "b", quantity: "2", unitId: "tbsp", food: "   " },
    ],
  });
  expect(parseAlternatives([two]).alternatives[0]!.items).toEqual([{ quantity: 1, unitId: "cup", food: "milk" }]);
});

test("refuses an amount that is not a number, a 'per' of zero, a 'per' unit with no amount, and more than one food for the plan", () => {
  expect(parseAlternatives([draft({ items: [{ key: "i", quantity: "lots", unitId: NO_UNIT, food: "milk" }] })]).error).toMatch(/milk must be a number/);
  expect(parseAlternatives([draft({ basisQuantity: "0" })]).error).toMatch(/above zero/);
  expect(parseAlternatives([draft({ basisUnitId: "cup" })]).error).toMatch(/needs an amount/);
  const pair = draft({
    planPicks: true,
    items: [
      { key: "a", quantity: "1", unitId: "cup", food: "milk" },
      { key: "b", quantity: "1", unitId: "tbsp", food: "lemon juice" },
    ],
  });
  expect(parseAlternatives([pair]).error).toMatch(/one food/);
});

test("a stored alternative drafts back to what it was", () => {
  const stored = {
    basisQuantity: 1,
    basisUnitId: "cup",
    note: "stand 5 minutes",
    planPicks: false,
    items: [{ quantity: 1, unitId: "tbsp", food: "lemon juice" }],
  };
  const back = alternativeDraft(stored);
  expect(back).toMatchObject({
    basisQuantity: "1",
    basisUnitId: "cup",
    note: "stand 5 minutes",
    items: [{ quantity: "1", unitId: "tbsp", food: "lemon juice" }],
  });
  expect(parseAlternatives([back]).alternatives).toEqual([stored]);
});
