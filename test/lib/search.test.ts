// Pure key-handling helpers behind the plan add sheet's recipe search: how
// the arrow keys move the highlight and how a selected index maps onto a
// result list.
import { describe, expect, test } from "vitest";
import { clampSelection, nextSearchIndex, selectedResult } from "../../src/lib/search";

describe("nextSearchIndex", () => {
  test("moves down and up within range", () => {
    expect(nextSearchIndex(0, 3, "ArrowDown")).toBe(1);
    expect(nextSearchIndex(1, 3, "ArrowUp")).toBe(0);
  });

  test("clamps at the last item instead of wrapping", () => {
    expect(nextSearchIndex(2, 3, "ArrowDown")).toBe(2);
  });

  test("clamps at the first item instead of wrapping", () => {
    expect(nextSearchIndex(0, 3, "ArrowUp")).toBe(0);
  });

  test("no selection yet lands on the first item going down", () => {
    expect(nextSearchIndex(-1, 3, "ArrowDown")).toBe(0);
  });

  test("Home, End and any other key are left to the text input", () => {
    expect(nextSearchIndex(1, 3, "Home")).toBeNull();
    expect(nextSearchIndex(1, 3, "End")).toBeNull();
    expect(nextSearchIndex(1, 3, "a")).toBeNull();
  });

  test("an empty result list has nowhere to go", () => {
    expect(nextSearchIndex(0, 0, "ArrowDown")).toBeNull();
  });
});

describe("selectedResult", () => {
  test("the item at a valid index", () => {
    expect(selectedResult(["a", "b", "c"], 1)).toBe("b");
  });

  test("out of range, in either direction, is null", () => {
    expect(selectedResult(["a"], -1)).toBeNull();
    expect(selectedResult(["a"], 1)).toBeNull();
  });

  test("an empty list is always null", () => {
    expect(selectedResult([], 0)).toBeNull();
  });
});

describe("clampSelection", () => {
  test("stays put when already in range", () => {
    expect(clampSelection(2, 5)).toBe(2);
  });

  test("falls back to the last index when the list shrank past it", () => {
    expect(clampSelection(4, 2)).toBe(1);
  });

  test("never goes negative", () => {
    expect(clampSelection(-3, 5)).toBe(0);
  });

  test("an empty list clamps to 0", () => {
    expect(clampSelection(2, 0)).toBe(0);
  });
});
