// The grid/list view toggle: grid selected by default, and reflects whatever
// is already stored, same style as IngredientModeToggle.test.tsx's persistence
// check.
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test } from "vitest";
import { ViewModeToggle } from "../../../../src/routes/home/components/ViewModeToggle";
import { setViewMode, type StorageLike } from "../../../../src/lib/prefs";

function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("ViewModeToggle", () => {
  test("renders grid selected when nothing is stored", () => {
    const html = renderToString(<ViewModeToggle />);
    expect(html).toMatch(/aria-label="Grid view"[^>]*aria-checked="true"/);
    expect(html).toMatch(/aria-label="List view"[^>]*aria-checked="false"/);
  });

  test("a stored list preference survives a reload: list renders checked", () => {
    const storage = fakeStorage();
    setViewMode(storage, "list");
    (globalThis as { window?: unknown }).window = { localStorage: storage };

    const html = renderToString(<ViewModeToggle />);
    expect(html).toMatch(/aria-label="List view"[^>]*aria-checked="true"/);
    expect(html).toMatch(/aria-label="Grid view"[^>]*aria-checked="false"/);
  });
});
