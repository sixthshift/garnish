// The design system's CSS as garnish's build sees it, for tests that check
// garnish's markup against what the library actually defines.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = join(import.meta.dirname, "..", "..");

/** `path`'s CSS with every relative `@import "./x.css"` inlined, recursively. Package imports are left as they are. */
export function cssWithImports(path: string, seen = new Set<string>()): string {
  if (seen.has(path)) return "";
  seen.add(path);
  const css = readFileSync(path, "utf8");
  return css.replace(/@import\s+"(\.\.?\/[^"]+)"[^;]*;/g, (_match, target: string) => cssWithImports(join(dirname(path), target), seen));
}

/**
 * The library's theme entry (`themes/linen.css`, resolved via its package.json
 * exports, not a hardcoded path) with its relative @imports inlined: tokens,
 * palette, the Tailwind mapping, the intent slots and every component recipe.
 */
export function designSystemCss(): string {
  const dir = join(root, "node_modules", "@sixthshift", "design-system");
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { exports: Record<string, string> };
  return cssWithImports(join(dir, pkg.exports["./themes/linen.css"]!));
}

/** garnish's own re-skin, `src/styles/theme.css`. */
export function garnishThemeCss(): string {
  return readFileSync(join(root, "src", "styles", "theme.css"), "utf8");
}
