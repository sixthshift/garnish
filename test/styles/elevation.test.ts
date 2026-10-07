// Design-language rule 1: a card lifts off the page. In dark mode the page was
// once earth-900 and a card earth-950, so every card read as a hole in the
// page (decision 139). This resolves the two surface tokens in each mode
// block of src/styles/theme.css through its palette and holds the order:
// the card is lighter than the page, in light and in dark.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const css = readFileSync(join(import.meta.dirname, "..", "..", "src", "styles", "theme.css"), "utf8");

/** The declarations inside the first block whose selector list contains `selector`. Pure. */
function block(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no block for ${selector}`);
  return source.slice(start, source.indexOf("}", start));
}

/** `name`'s value in `body`, following one `var(--color-…)` into the palette. Pure. */
function resolve(body: string, name: string): string {
  const value = new RegExp(`${name}:\\s*([^;]+);`).exec(body)?.[1]?.trim();
  if (value === undefined) throw new Error(`no ${name}`);
  const ref = /^var\((--color-[a-z0-9-]+)\)$/.exec(value)?.[1];
  return ref === undefined ? value : resolve(block(css, ":root"), ref);
}

/** WCAG relative luminance of a `#rrggbb`. Pure. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

test.each([
  ["light", ':root[data-theme="light"]'],
  ["dark", ':root[data-theme="dark"]'],
])("in %s the card (bg-normal) is lighter than the page (bg-subtle)", (_mode, selector) => {
  const body = block(css, selector);
  expect(luminance(resolve(body, "--bg-normal"))).toBeGreaterThan(luminance(resolve(body, "--bg-subtle")));
});
