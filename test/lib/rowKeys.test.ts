// What Enter does inside a list of editable rows (M21.4). The decision is
// pure; `focusNamed` needs a document and there is no jsdom in this project's
// vitest config, so what is asserted of it is that it no-ops rather than
// throwing on the server.
import { describe, expect, test } from "vitest";
import { focusNamed, rowEnter, rowFieldName } from "../../src/lib/rowKeys";

describe("rowEnter", () => {
  test("the last row appends", () => {
    expect(rowEnter(2, 3)).toBe("append");
    expect(rowEnter(0, 1)).toBe("append");
  });

  test("any earlier row moves to the next", () => {
    expect(rowEnter(0, 3)).toBe("next");
    expect(rowEnter(1, 3)).toBe("next");
  });

  test("an empty list or an index outside it does nothing", () => {
    expect(rowEnter(0, 0)).toBe("ignore");
    expect(rowEnter(-1, 3)).toBe("ignore");
    expect(rowEnter(3, 3)).toBe("ignore");
    expect(rowEnter(9, 3)).toBe("ignore");
  });
});

describe("rowFieldName", () => {
  test("names the field the next row focuses", () => {
    expect(rowFieldName("parts.0.ingredients", 2, "quantity")).toBe("parts.0.ingredients.2.quantity");
    expect(rowFieldName("parts.1.steps", 0, "text")).toBe("parts.1.steps.0.text");
  });
});

describe("focusNamed", () => {
  test("does nothing without a document rather than throwing", () => {
    expect(() => focusNamed("parts.0.ingredients.0.quantity")).not.toThrow();
  });
});
