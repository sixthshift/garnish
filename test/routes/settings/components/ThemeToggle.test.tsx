// The theme toggle: three options, System selected when nothing is stored (the
// server snapshot), and the guard that keeps a stray string out of prefs.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { getTheme, type StorageLike, setTheme } from "../../../../src/lib/prefs";
import { isTheme, ThemeToggle, themeOptions } from "../../../../src/routes/settings/components/ThemeToggle";

describe("isTheme", () => {
  test.each([
    ["light", true],
    ["dark", true],
    ["system", true],
    ["", false],
    ["Dark", false],
    ["auto", false],
  ])("%s -> %s", (value, expected) => {
    expect(isTheme(value)).toBe(expected);
  });
});

describe("themeOptions", () => {
  test("offers light, dark and system, in that order", () => {
    expect(themeOptions.map((option) => option.value)).toEqual(["light", "dark", "system"]);
  });
});

describe("ThemeToggle", () => {
  test("renders a radiogroup of the three labels with System selected by default", () => {
    const html = renderToString(<ThemeToggle />);
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Theme"');
    for (const option of themeOptions) expect(html).toContain(option.label);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
  });
});

describe("persistence", () => {
  test("a chosen theme round-trips through the key the boot script reads", () => {
    const map = new Map<string, string>();
    const storage: StorageLike = { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
    setTheme(storage, "dark");
    // The inline script in root.tsx and the design system both read "theme"
    // as JSON; a reload picks the choice up from there.
    expect(map.get("theme")).toBe('"dark"');
    expect(getTheme(storage)).toBe("dark");
  });
});
