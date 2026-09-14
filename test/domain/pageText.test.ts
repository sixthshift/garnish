// Readable page text (M36.3): the AI import rung reads this rather than raw
// HTML. `sectioned-page.html` is a synthetic WordPress-Recipe-Maker-shaped
// page (see its own header comment) built for this check, because the
// recorded `recipe-200.html` fixture from M35.4 has no headings to lose.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { MAX_AI_TEXT } from "../../src/server/aiImport";
import { MAX_PAGE_TEXT, readableText } from "../../src/domain/pageText";

const FIXTURES = join(import.meta.dirname, "../fixtures/importUrl");
const SECTIONED_PAGE = readFileSync(join(FIXTURES, "sectioned-page.html"), "utf8");
const RECIPE_200 = readFileSync(join(FIXTURES, "recipe-200.html"), "utf8");

describe("readableText", () => {
  test("drops script, style, noscript, nav, header, footer and aside, comments included", () => {
    const text = readableText(SECTIONED_PAGE);
    expect(text).not.toContain("dataLayer");
    expect(text).not.toContain("font-family");
    expect(text).not.toContain("Home");
    expect(text).not.toContain("Advertisement");
    expect(text).not.toContain("All rights reserved");
    expect(text).not.toContain("Enable JavaScript");
  });

  test("an ingredient group heading survives as its own `# ` line, for each group", () => {
    const lines = readableText(SECTIONED_PAGE).split("\n");
    expect(lines).toContain("# Sauce");
    expect(lines).toContain("# Fried rice");
  });

  test("the recipe's own heading and body text survive too", () => {
    const text = readableText(SECTIONED_PAGE);
    expect(text).toContain("# Fried Rice with Sauce");
    expect(text).toContain("2 tbsp soy sauce");
    expect(text).toContain("Whisk the sauce ingredients together.");
  });

  test("the result is under the cap", () => {
    expect(readableText(SECTIONED_PAGE).length).toBeLessThan(MAX_PAGE_TEXT);
  });

  test("a page over the cap is truncated to it", () => {
    const big = `<p>${"x".repeat(MAX_PAGE_TEXT + 5_000)}</p>`;
    expect(readableText(big).length).toBe(MAX_PAGE_TEXT);
  });

  test("`<br>` and `</p>` both end a line", () => {
    expect(readableText("<p>First.<br>Second.</p><p>Third.</p>").split("\n")).toEqual(["First.", "Second.", "Third."]);
  });

  test("a heading comes out prefixed `# ` regardless of level", () => {
    expect(readableText("<h1>One</h1><h3>Three</h3>").split("\n")).toEqual(["# One", "# Three"]);
  });

  test("an `li` is its own line", () => {
    expect(readableText("<ul><li>A</li><li>B</li></ul>").split("\n")).toEqual(["A", "B"]);
  });

  test("entities decode", () => {
    expect(readableText("<p>Salt &amp; pepper</p>")).toBe("Salt & pepper");
  });

  test("runs of whitespace collapse", () => {
    expect(readableText("<p>Sharp   and   buttery.</p>")).toBe("Sharp and buttery.");
  });

  test("no DOM is needed: a malformed or unclosed tag does not throw", () => {
    expect(() => readableText("<p>Unclosed <div>nested")).not.toThrow();
  });

  test("the recorded stub fixture yields non-empty text with no markup left in it", () => {
    const text = readableText(RECIPE_200);
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain("<");
  });

  test("aiImport's MAX_AI_TEXT is this cap, so there is one number rather than two that can drift", () => {
    expect(MAX_AI_TEXT).toBe(MAX_PAGE_TEXT);
  });
});
