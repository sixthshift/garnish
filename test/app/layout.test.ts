// The two experiences (decisions.md row 206): one line, followed two ways.
// Tailwind's `md:` and `lg:` are gone, so nothing breaks at a third width the
// layouts do not know; and what is only a phone's or only a desktop's stays
// apart, neither importing the other.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { DESKTOP_MEDIA, LAYOUT_BOOT_SCRIPT, layoutNow } from "../../src/lib/layout";

const root = resolve(import.meta.dirname, "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|css)$/.test(name)) out.push(path);
  }
  return out;
}

const files = walk(join(root, "src"));

/** Relative import specifiers in a file, as test/modules.test.ts reads them. Pure. */
function relativeSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:from\s+|import\s+|import\(\s*)["'](\.\.?\/[^"']+)["']/g)].map((match) => match[1]!);
}

/** A `md:` or `lg:` variant (or its `max-`), not a container query (`@md:`) nor a token's name (`--radius-md:`). Pure. */
export function breakpointsIn(source: string): string[] {
  return [...source.matchAll(/(?<![\w@-])(?:max-)?(?:md|lg):[\w[(-]/g)].map((match) => match[0]);
}

describe("the line", () => {
  test("is 64rem, and with no screen to ask it is a phone's", () => {
    expect(DESKTOP_MEDIA).toBe("(min-width: 64rem)");
    expect(layoutNow()).toBe("mobile");
  });

  test("the boot script puts the same answer on <html data-layout>", () => {
    const listeners: (() => void)[] = [];
    const media = { matches: true, addEventListener: (_: string, fn: () => void) => listeners.push(fn) };
    const html = { dataset: {} as Record<string, string> };
    new Function("matchMedia", "document", LAYOUT_BOOT_SCRIPT)((query: string) => (query === DESKTOP_MEDIA ? media : null), { documentElement: html });
    expect(html.dataset.layout).toBe("desktop");
    media.matches = false;
    for (const fn of listeners) fn();
    expect(html.dataset.layout).toBe("mobile");
  });
});

describe("breakpointsIn", () => {
  test("finds md: and lg:, and leaves container queries and tokens alone", () => {
    expect(breakpointsIn('className="p-4 md:p-6 max-md:hidden lg:grid"')).toEqual(["md:p", "max-md:h", "lg:g"]);
    expect(breakpointsIn('"@md:flex @max-2xl:hidden" --border-radius-md: 0.5rem; desktop:p-6')).toEqual([]);
  });
});

test("no source uses md: or lg:", () => {
  const found = files.flatMap((file) => breakpointsIn(readFileSync(file, "utf8")).map((hit) => `${relative(root, file)}: ${hit}`));
  expect(found).toEqual([]);
});

test("a phone's code never imports a desktop's, nor the other way", () => {
  const side = (path: string) => (/(^|\/)mobile\//.test(path) ? "mobile" : /(^|\/)desktop\//.test(path) ? "desktop" : null);
  const crossed: string[] = [];
  for (const file of files) {
    const from = side(relative(root, file));
    if (from === null) continue;
    for (const specifier of relativeSpecifiers(readFileSync(file, "utf8"))) {
      const to = side(relative(root, resolve(dirname(file), specifier)));
      if (to !== null && to !== from) crossed.push(`${relative(root, file)} → ${specifier}`);
    }
  }
  expect(crossed).toEqual([]);
});
