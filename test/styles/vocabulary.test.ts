// The design system's `variant` and `intent` props are typed loosely on
// purpose — a consuming app may add its own in CSS — so a value the library
// never styled, or has since removed, still type-checks and renders as the
// neutral floor. Design system 0.9 removed Button's `link` variant and Badge's
// `muted` intent, and garnish kept rendering both, unstyled, for ten days
// (decisions.md row 180). This holds every literal `variant` and `intent` on a
// design system component against the CSS that defines them: the library's
// recipes and intent slots, plus garnish's own theme.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import { designSystemCss, garnishThemeCss } from "../helpers/designSystem";

const root = join(import.meta.dirname, "..", "..");

/**
 * The class each component's recipe styles its variants through. A component
 * missing here that is given a literal `variant` fails the test, so the next
 * one is added rather than skipped.
 */
const RECIPE_HOOK: Record<string, string> = {
  Button: "btn",
  Badge: "badge",
  Toggle: "toggle",
  ToggleGroup: "toggle-group-item",
};

/** Every intent a slot is defined for: `[data-intent="x"]` anywhere in `css`. Pure. */
export function styledIntents(css: string): Set<string> {
  return new Set([...css.matchAll(/\[data-intent="([a-z-]+)"\]/g)].map((match) => match[1]!));
}

/** The variants `css` styles for the recipe hook `hook`: `.hook[data-variant="x"]`. Pure. */
export function styledVariants(css: string, hook: string): Set<string> {
  const found = new Set<string>();
  for (const match of css.matchAll(/\.([a-z-]+)\[data-variant="([a-z-]+)"\]/g)) {
    if (match[1] === hook) found.add(match[2]!);
  }
  return found;
}

/** The capitalised names `source` imports from the design system: `Button`, `Badge`. Pure. */
export function designSystemComponents(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']@sixthshift\/design-system\/[^"']+["']/g)) {
    for (const specifier of match[1]!.split(",")) {
      const local = specifier
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)
        .pop()!;
      if (/^[A-Z]/.test(local)) names.add(local);
    }
  }
  return names;
}

/**
 * Each opening tag of a component in `components`, with its literal string
 * `variant` and `intent` props. An expression prop (`intent={x}`) is not a
 * literal and is skipped; braces are tracked so a `>` in `onClick={() => …}`
 * does not end the tag. Pure.
 */
export function literalProps(source: string, components: ReadonlySet<string>): Array<{ component: string; prop: "variant" | "intent"; value: string }> {
  const found: Array<{ component: string; prop: "variant" | "intent"; value: string }> = [];
  for (const match of source.matchAll(/<([A-Z][A-Za-z]*)\b/g)) {
    const component = match[1]!;
    if (!components.has(component)) continue;
    let attributes = "";
    let depth = 0;
    for (let index = match.index + match[0].length; index < source.length; index++) {
      const char = source[index]!;
      if (char === "{") depth++;
      else if (char === "}") depth--;
      else if (char === ">" && depth === 0) break;
      else if (depth === 0) attributes += char;
    }
    for (const prop of attributes.matchAll(/\b(variant|intent)="([^"]*)"/g)) {
      found.push({ component, prop: prop[1] as "variant" | "intent", value: prop[2]! });
    }
  }
  return found;
}

function walkTsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walkTsxFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("styledIntents and styledVariants", () => {
  const css = `
    [data-intent], [data-intent="neutral"] { --intent-fg: black; }
    [data-intent="brand"] { --intent-fg: teal; }
    .btn[data-variant="solid"] { --button-bg: black; }
    .btn[data-variant="outline"], .btn[data-variant="ghost"] { --button-bg: none; }
    .badge[data-variant="soft"] { --badge-bg: grey; }
  `;

  test("an intent is any slot defined by name", () => {
    expect([...styledIntents(css)].sort()).toEqual(["brand", "neutral"]);
  });

  test("a variant belongs to the hook that styles it", () => {
    expect([...styledVariants(css, "btn")].sort()).toEqual(["ghost", "outline", "solid"]);
    expect([...styledVariants(css, "badge")]).toEqual(["soft"]);
  });
});

describe("literalProps", () => {
  const components = new Set(["Button", "Badge"]);

  test("reads literal variant and intent off a design system component, across lines and past arrow functions", () => {
    const source = `<Button
      variant="ghost"
      onClick={() => go(1 > 0)}
      intent="neutral"
    >Go</Button>`;
    expect(literalProps(source, components)).toEqual([
      { component: "Button", prop: "variant", value: "ghost" },
      { component: "Button", prop: "intent", value: "neutral" },
    ]);
  });

  test("ignores expressions, strings inside expressions and other components", () => {
    const source = `<Button intent={tone} title={"variant=\\"x\\""} /><Menu intent="danger" />`;
    expect(literalProps(source, components)).toEqual([]);
  });
});

describe("designSystemComponents", () => {
  test("takes the local names imported from a design system subpath", () => {
    const source = `import { Button, buttonVariants } from "@sixthshift/design-system/button";
import { Badge as Chip, type BadgeProps } from "@sixthshift/design-system/badge";
import { Menu } from "./Menu";`;
    expect([...designSystemComponents(source)].sort()).toEqual(["BadgeProps", "Button", "Chip"]);
  });
});

describe("every variant and intent garnish passes is one the CSS styles", () => {
  const css = `${designSystemCss()}\n${garnishThemeCss()}`;
  const intents = styledIntents(css);

  test("found the intent slots, so an empty set can't fake a pass", () => {
    expect(intents).toContain("neutral");
    expect(intents).toContain("brand");
    for (const hook of Object.values(RECIPE_HOOK)) expect(styledVariants(css, hook).size).toBeGreaterThan(0);
  });

  test("under src/", () => {
    const offenders: string[] = [];
    for (const file of walkTsxFiles(join(root, "src"))) {
      const source = readFileSync(file, "utf8");
      for (const { component, prop, value } of literalProps(source, designSystemComponents(source))) {
        const where = `${relative(root, file)}: <${component} ${prop}="${value}">`;
        if (prop === "intent" && !intents.has(value)) offenders.push(where);
        if (prop === "variant") {
          const hook = RECIPE_HOOK[component];
          if (hook === undefined) offenders.push(`${where} — no recipe hook listed for ${component}`);
          else if (!styledVariants(css, hook).has(value)) offenders.push(where);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
