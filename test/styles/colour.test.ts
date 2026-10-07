// Critique #8, design-language rule 5: colour is identity and state. These read
// the source, as AppShell.test does, for the places the rule was broken: brand
// as the nav's emphasis, red on affordances that open nothing, a scale named
// for a hue it is not, and a neutral Badge painted in the page's own tone.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const src = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", "src", path), "utf8");
const theme = src("styles/theme.css");

test("the brand scale is declared as teal, with the values that ship", () => {
  expect(theme).toContain("--color-teal-600: #2c666c;");
  expect(theme).toContain("--color-teal-400: #4ba5a9;");
  expect(theme).not.toMatch(/--color-emerald-\d+:/);
  expect(theme).not.toMatch(/var\(--color-emerald-/);
});

test("the nav's current place takes the toggles' neutral selected fill, not brand", () => {
  const shell = src("components/shell/AppShell.tsx");
  const active = shell.match(/const activeClass = "([^"]+)"/)?.[1] ?? "";
  expect(active).toBe("bg-bg-subtle-pressed text-fg-normal");
});

test("neither Remove image nor Clear ticked is red: the red is the confirm step's", () => {
  expect(src("components/ui/ImageUpload.tsx")).not.toContain('intent="danger"');
  expect(src("routes/shopping/components/ShoppingListView.tsx")).not.toContain('intent="danger"');
});

test("a neutral soft Badge is filled one step past the page, once, in the theme", () => {
  expect(theme).toMatch(/\.badge\[data-variant="soft"\]:not\([^)]*\) \{\s*--badge-bg: var\(--bg-subtle-pressed\);/);
  expect(src("routes/settings/page.tsx")).not.toContain("--badge-bg");
});

test("every segmented toggle is outline, so selected reads one way", () => {
  expect(src("routes/recipes/components/style/StyleSpace.tsx")).toMatch(/appearance="segmented"\s+variant="outline"/);
  expect(src("routes/settings/components/ThemeToggle.tsx")).toMatch(/appearance="segmented"\s+variant="outline"/);
});
