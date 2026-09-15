// The structured/summary switch: unchecked (structured) by default, and
// reflects whatever is already stored — proof the choice persists across a
// reload, same style as ThemeToggle.test.tsx's persistence check.
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test } from "vitest";
import { type StorageLike, setIngredientMode } from "../../../../../src/lib/prefs";
import { IngredientModeToggle } from "../../../../../src/routes/recipes/recipe/components/IngredientModeToggle";

function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("IngredientModeToggle", () => {
  test("renders unchecked (structured) when nothing is stored", () => {
    const html = renderToString(<IngredientModeToggle />);
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('data-state="unchecked"');
    expect(html).toContain("One list");
  });

  test("a stored summary preference survives a reload: the switch renders checked", () => {
    const storage = fakeStorage();
    setIngredientMode(storage, "summary");
    (globalThis as { window?: unknown }).window = { localStorage: storage };

    const html = renderToString(<IngredientModeToggle />);
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('data-state="checked"');
  });
});
