// The bulk-add sheet's three buttons and the split that turns its text into
// items (M13.4). Pure text transforms only; no rendering here.
import { describe, expect, test } from "vitest";
import { bulkLines, paragraphs, splitOnBlankLines, stripLeadingNumbers, trimLines } from "../../../src/domain/ingredient/bulkText";

describe("trimLines", () => {
  test("trims each line, leaving blank lines blank", () => {
    expect(trimLines("  Salt  \n  Pepper\nOil  ")).toBe("Salt\nPepper\nOil");
    expect(trimLines("  \nSalt\n   \n")).toBe("\nSalt\n\n");
  });

  test("a single line with no surrounding whitespace is unchanged", () => {
    expect(trimLines("Salt")).toBe("Salt");
  });
});

describe("stripLeadingNumbers", () => {
  test("drops a numbered-list marker from the front of each line", () => {
    expect(stripLeadingNumbers("1. Chop onions\n2) Dice garlic\n10 Preheat oven")).toBe("Chop onions\nDice garlic\nPreheat oven");
    expect(stripLeadingNumbers("3: Add salt")).toBe("Add salt");
  });

  test("leading whitespace before the number is allowed; a line with no marker is unchanged", () => {
    expect(stripLeadingNumbers("  4. Whisk eggs")).toBe("Whisk eggs");
    expect(stripLeadingNumbers("Just chop it")).toBe("Just chop it");
  });

  test("does not touch a number that is not at the start of the line", () => {
    expect(stripLeadingNumbers("Cook for 10 minutes")).toBe("Cook for 10 minutes");
  });
});

describe("paragraphs", () => {
  test("splits on one or more blank lines, joining a wrapped paragraph's own lines with a space", () => {
    expect(paragraphs("Chop the onion.\n\nMix flour and\nsugar together.\n\n\nBake.")).toEqual(["Chop the onion.", "Mix flour and sugar together.", "Bake."]);
  });

  test("drops leading, trailing and doubled separators rather than yielding empty paragraphs", () => {
    expect(paragraphs("\n\nOnly one.\n\n")).toEqual(["Only one."]);
    expect(paragraphs("  \n \nA.\n\n   \n\nB.")).toEqual(["A.", "B."]);
  });

  test("one paragraph with no blank-line separator stays one item", () => {
    expect(paragraphs("Mix.\nThen fold.")).toEqual(["Mix. Then fold."]);
  });

  test("blank text is no paragraphs", () => {
    expect(paragraphs("")).toEqual([]);
    expect(paragraphs("   \n\n  ")).toEqual([]);
  });
});

describe("splitOnBlankLines", () => {
  test("rejoins the paragraphs one per line", () => {
    expect(splitOnBlankLines("Chop onions.\n\nDice garlic and\nset aside.")).toBe("Chop onions.\nDice garlic and set aside.");
  });
});

describe("bulkLines", () => {
  test("splits on newlines, trims, and drops blank lines", () => {
    expect(bulkLines("Salt\n  Pepper  \n\nOil\n")).toEqual(["Salt", "Pepper", "Oil"]);
  });

  test("blank text is no lines", () => {
    expect(bulkLines("")).toEqual([]);
    expect(bulkLines("\n\n  \n")).toEqual([]);
  });
});
