// The print stylesheet (M11.6). Printing cannot be exercised headlessly, so
// this asserts the rules are in src/styles.css and that they name the elements
// the recipe view actually renders.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const css = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");

/** The body of the `@media print` block, brace-matched from its opening. Pure. */
function printBlock(source: string): string {
  const start = source.indexOf("@media print");
  if (start < 0) return "";
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(source.indexOf("{", start) + 1, i);
  }
  return "";
}

describe("print stylesheet", () => {
  const block = printBlock(css);

  test("styles.css has an @media print block", () => {
    expect(css).toContain("@media print");
    expect(block.trim()).not.toBe("");
  });

  test("hides the app chrome and the page's controls", () => {
    for (const selector of [
      "nav",
      "aside",
      '[data-print="hide"]',
      '[data-testid="menu"]',
      '[data-testid="ingredient-mode-toggle"]',
      '[data-testid="scale-to-trigger"]',
      '[aria-label="Scale servings"]',
      '[aria-label^="Tick off"]',
    ]) {
      expect(block).toContain(selector);
    }
    expect(block).toContain("display: none !important");
  });

  test("keeps the image beside the text", () => {
    expect(block).toContain('[data-layout="split"]');
    expect(block).toContain("flex-direction: row !important");
  });

  test("sets ingredients in two columns", () => {
    expect(block).toContain('ul[aria-label="Ingredients"]');
    expect(block).toContain("column-count: 2");
    expect(block).toContain("break-inside: avoid");
  });

  test("keeps the notes", () => {
    expect(block).toContain('[aria-label="Notes"]');
  });

  test("sets a page margin", () => {
    expect(block).toContain("@page");
  });
});
