// Critique #8, design-language rule 5: colour is identity and state. These read
// the source, as AppShell.test does, for the places the rule was broken: brand
// as the nav's emphasis, red on affordances that open nothing, a scale named
// for a hue it is not, and a neutral Badge painted in the page's own tone.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
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

/** Every `.tsx` under src/, relative to it. */
function tsxFiles(dir = join(import.meta.dirname, "..", "..", "src")): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith(".tsx") ? [relative(join(import.meta.dirname, "..", "..", "src"), path)] : [];
  });
}

/** True when `source` has a Button or Menu.Item whose props say `intent="danger"`; an arrow function's `=>` in an earlier prop does not end the tag. Pure. */
export function hasRedAction(source: string): boolean {
  return /<(Button|Menu\.Item)\b(?:=>|[^>])*?intent="danger"/.test(source);
}

test("hasRedAction reads past an arrow function in an earlier prop", () => {
  expect(hasRedAction('<Button onClick={() => x()} intent="danger">')).toBe(true);
  expect(hasRedAction('<Menu.Item\n  onSelect={() => setOpen(true)}\n  intent="danger"\n>')).toBe(true);
  expect(hasRedAction('<Button onClick={() => x()} intent="neutral">Delete</Button> <Message intent="danger" />')).toBe(false);
});

// A favourited heart is red too, but that is state (`aria-pressed`), not an action, and its intent is an expression.
test("red is the confirm's: a danger Button or menu item is a confirm, or a ⋯ item that opens one", () => {
  // Each allowed file, and whether its red opens a dialog it must render (false: the red is the confirm step itself).
  const allowed: Record<string, boolean> = {
    "components/ui/ConfirmDialog.tsx": false, // the confirm itself
    "routes/recipes/recipe/components/RecipeActions.tsx": true, // Delete recipe
    "routes/recipes/recipe/components/TimelineRow.tsx": true, // Delete a cook-log entry
    "routes/recipes/recipe/style/page.tsx": false, // Restore, the inline confirm's second step
    "routes/settings/components/RestoreSheet.tsx": false, // the backup restore's own confirm
    "routes/settings/components/tabs/AislesTab.tsx": true, // Delete aisle
    "routes/settings/components/tabs/TagsTab.tsx": true, // Delete tag
  };
  const red = tsxFiles().filter((file) => hasRedAction(src(file)));
  expect(red.sort()).toEqual(Object.keys(allowed).sort());
  for (const [file, opensConfirm] of Object.entries(allowed)) {
    if (opensConfirm) expect(src(file), file).toMatch(/<(ConfirmDialog|UsageConfirmDialog)\b/);
  }
});

test("a neutral soft Badge is filled one step past the page, once, in the theme", () => {
  expect(theme).toMatch(/\.badge\[data-variant="soft"\]:not\([^)]*\) \{\s*--badge-bg: var\(--bg-subtle-pressed\);/);
  expect(src("routes/settings/page.tsx")).not.toContain("--badge-bg");
});

test("the selected Tab takes the neutral selected fill, in the theme", () => {
  expect(theme).toMatch(/\.tabs-trigger\[data-selected="true"\] \{\s*--tabs-trigger-bg: var\(--bg-subtle-pressed\);\s*--tabs-trigger-fg: var\(--fg-normal\);/);
});

test("a style step's Keep and Original are outline neutral toggles, never brand", () => {
  const step = src("routes/recipes/components/style/StyleStep.tsx");
  expect(step).not.toContain('"brand"');
  expect(step).not.toContain('"solid"');
  expect(step.match(/className=\{cn\(choice === "(rewrite|original)" && CHOSEN\)\}/g)).toHaveLength(2);
});

test("every segmented toggle is outline, so selected reads one way", () => {
  expect(src("routes/recipes/components/style/StyleSpace.tsx")).toMatch(/appearance="segmented"\s+variant="outline"/);
  expect(src("routes/settings/components/ThemeToggle.tsx")).toMatch(/appearance="segmented"\s+variant="outline"/);
});
