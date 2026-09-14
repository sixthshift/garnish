// Pure key-handling helpers behind global search (M12.5): whether a "/"
// keydown should open the dialog, and how a selected index maps onto a
// result list.
import { describe, expect, test } from "vitest";
import { clampSelection, isTypingTarget, nextSearchIndex, selectedResult, shouldOpenGlobalSearch } from "../../src/lib/search";

describe("isTypingTarget", () => {
  test("input, textarea and select all count as typing", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "textarea" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
  });

  test("a contenteditable region counts even with an unrelated tag", () => {
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  test("a plain element, or no target at all, does not", () => {
    expect(isTypingTarget({ tagName: "DIV" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(undefined)).toBe(false);
  });
});

describe("shouldOpenGlobalSearch", () => {
  test("a bare slash outside a form control opens it", () => {
    expect(shouldOpenGlobalSearch({ key: "/" }, { tagName: "BODY" }, false)).toBe(true);
    expect(shouldOpenGlobalSearch({ key: "/" }, null, false)).toBe(true);
  });

  test("any other key does not", () => {
    expect(shouldOpenGlobalSearch({ key: "a" }, { tagName: "BODY" }, false)).toBe(false);
    expect(shouldOpenGlobalSearch({ key: "Enter" }, { tagName: "BODY" }, false)).toBe(false);
  });

  test("a modifier held down does not — Ctrl+/, Cmd+/ and Alt+/ are left alone", () => {
    expect(shouldOpenGlobalSearch({ key: "/", ctrlKey: true }, { tagName: "BODY" }, false)).toBe(false);
    expect(shouldOpenGlobalSearch({ key: "/", metaKey: true }, { tagName: "BODY" }, false)).toBe(false);
    expect(shouldOpenGlobalSearch({ key: "/", altKey: true }, { tagName: "BODY" }, false)).toBe(false);
  });

  test("typing in a field keeps its literal slash", () => {
    expect(shouldOpenGlobalSearch({ key: "/" }, { tagName: "INPUT" }, false)).toBe(false);
    expect(shouldOpenGlobalSearch({ key: "/" }, { tagName: "DIV", isContentEditable: true }, false)).toBe(false);
  });

  test("already open does not reopen", () => {
    expect(shouldOpenGlobalSearch({ key: "/" }, { tagName: "BODY" }, true)).toBe(false);
  });
});

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
