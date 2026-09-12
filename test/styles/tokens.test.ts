// Combobox's dropdown once painted with `bg-bg-base`, a token the design
// system does not define, so it rendered transparent (M29.5). This guards
// every `bg-bg-*`, `text-fg-*` and `border-border-*` class under src/ against
// the real token set: the design system's theme file (resolved via its
// package.json exports, not a hardcoded path) plus garnish's own
// src/styles/theme.css, which re-points those tokens and may add new ones.
// A guessed token now fails the gate instead of painting nothing.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");

/**
 * Token names declared as `--color-(bg|fg|border)-*`, with the `--color-`
 * prefix stripped, e.g. `--color-bg-normal-hovered` becomes
 * `bg-normal-hovered`. Other custom properties (`--color-brand-500`,
 * `--bg-strong`) are ignored. Pure.
 */
export function tokenNames(css: string): Set<string> {
  const names = new Set<string>();
  for (const match of css.matchAll(/--color-(?:bg|fg|border)-[a-z-]+/g)) {
    names.add(match[0].slice("--color-".length));
  }
  return names;
}

const CLASS_PATTERN = /\b(bg-bg|text-fg|border-border)-[a-z-]+/g;

/** Tailwind utility prefix to strip off each match so the remainder lines up with a token name. */
const UTILITY_PREFIX: Record<string, string> = {
  "bg-bg": "bg-",
  "text-fg": "text-",
  "border-border": "border-",
};

/**
 * `bg-bg-*`, `text-fg-*` and `border-border-*` classes found in `source`,
 * paired with the token name they imply (`bg-bg-normal` -> `bg-normal`).
 * Trailing Tailwind opacity suffixes (`bg-bg-normal/80`) are excluded
 * automatically: `/` isn't in the character class, so the match stops before
 * it. Variant prefixes (`hover:bg-bg-normal`) are handled the same way: `\b`
 * sits right before `bg-bg`, so the match starts there regardless of what
 * precedes it. Pure.
 */
export function tokenClasses(source: string): Array<{ className: string; token: string }> {
  const found: Array<{ className: string; token: string }> = [];
  for (const match of source.matchAll(CLASS_PATTERN)) {
    const className = match[0];
    const prefix = UTILITY_PREFIX[match[1]!]!;
    found.push({ className, token: className.slice(prefix.length) });
  }
  return found;
}

/** Every `.tsx` file under `dir`, recursively. Not pure: reads the tree. */
function walkTsxFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkTsxFiles(path));
    } else if (entry.name.endsWith(".tsx")) {
      found.push(path);
    }
  }
  return found;
}

describe("tokenNames", () => {
  test("extracts --color-bg/fg/border- declarations without the --color- prefix", () => {
    const css = `:root {
      --color-bg-normal: red;
      --color-fg-subtle: blue;
      --color-border-normal-hovered: green;
      --color-brand-500: purple;
      --bg-strong: black;
    }`;
    expect([...tokenNames(css)].sort()).toEqual(["bg-normal", "border-normal-hovered", "fg-subtle"]);
  });
});

describe("tokenClasses", () => {
  test("finds bg-bg-, text-fg- and border-border- classes and their token name", () => {
    expect(
      tokenClasses('className="bg-bg-base border-border-normal text-fg-subtle/80 hover:bg-bg-normal-hovered"'),
    ).toEqual([
      { className: "bg-bg-base", token: "bg-base" },
      { className: "border-border-normal", token: "border-normal" },
      { className: "text-fg-subtle", token: "fg-subtle" },
      { className: "bg-bg-normal-hovered", token: "bg-normal-hovered" },
    ]);
  });

  test("ignores unrelated bg-/text-/border- classes", () => {
    expect(tokenClasses('className="bg-white text-sm border-2"')).toEqual([]);
  });
});

describe("real tokens only", () => {
  const designSystemDir = join(root, "node_modules", "@sixthshift", "design-system");
  const designSystemPkg = JSON.parse(readFileSync(join(designSystemDir, "package.json"), "utf8")) as {
    exports: Record<string, string>;
  };
  const themeCssPath = join(designSystemDir, designSystemPkg.exports["./theme.css"]!);

  const tokens = new Set([
    ...tokenNames(readFileSync(themeCssPath, "utf8")),
    ...tokenNames(readFileSync(join(root, "src", "styles", "theme.css"), "utf8")),
  ]);

  test("found at least one token, so an empty set can't fake a pass", () => {
    expect(tokens.size).toBeGreaterThan(0);
  });

  test("every bg-bg-*, text-fg- and border-border- class under src/ is backed by a real token", () => {
    const offenders: string[] = [];
    for (const file of walkTsxFiles(join(root, "src"))) {
      const rel = relative(root, file);
      const source = readFileSync(file, "utf8");
      for (const { className, token } of tokenClasses(source)) {
        if (!tokens.has(token)) offenders.push(`${rel}: ${className}`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
