// The display face's rule in theme.css is unlayered, so it beats every utility
// on a bare h1–h3. SectionTitle rendered as an h2 or h3 once came out in
// Fraunces without its tracking, and as an h4 or a span in Inter (critique
// #15b). The rule now skips `.uppercase`, SectionTitle's own class; this keeps
// the two in step.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const theme = readFileSync(join(root, "src", "styles", "theme.css"), "utf8");

test("the display face skips SectionTitle at every heading level", () => {
  const rule = /([^{}]*)\{\s*font-family:\s*var\(--font-display\)/.exec(theme);
  expect(rule?.[1]?.trim()).toMatch(/:is\(h1, h2, h3\):not\(\.uppercase\)$/);
  expect(renderToString(<SectionTitle as="h2">Ingredients</SectionTitle>)).toMatch(/^<h2 class="[^"]*\buppercase\b/);
});
