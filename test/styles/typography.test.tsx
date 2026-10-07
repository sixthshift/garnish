// The display face's rule in theme.css is unlayered, so it beats every utility
// on whatever it selects. Selecting h1–h3 once made SectionTitle's labels and
// every sheet's title serif (critique #15b). Fraunces is for page and recipe
// titles, and those are the h1s; anything else is Inter unless it opts in
// with `font-display`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Heading } from "@sixthshift/design-system/heading";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const theme = readFileSync(join(root, "src", "styles", "theme.css"), "utf8");

/** The selector of the rule that sets the display face. */
function displaySelector(): string | undefined {
  return /([^{}/]*)\{\s*font-family:\s*var\(--font-display\)/.exec(theme)?.[1]?.trim();
}

/** The tag an element renders as. */
const tag = (html: string) => /^<([a-z0-9]+)/.exec(html)?.[1];

test("the display face goes to h1 alone", () => {
  expect(displaySelector()).toBe("h1");
});

test("a page title is an h1, so Fraunces; a sheet title and a SectionTitle h2 are not, so Inter", () => {
  expect(tag(renderToString(<Heading as="h1">Recipes</Heading>))).toBe(displaySelector());
  // A sheet's title, as EditSheet and the other sheets write it.
  const sheet = renderToString(<h2 className="text-base font-medium">Edit ingredient</h2>);
  expect(tag(sheet)).not.toBe(displaySelector());
  expect(sheet).not.toContain("font-display");
  expect(tag(renderToString(<SectionTitle as="h2">Ingredients</SectionTitle>))).not.toBe(displaySelector());
});
