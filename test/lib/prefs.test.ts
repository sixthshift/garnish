// The preference table and the read and write over it, against an in-memory
// storage and one that throws on every access. The hooks share the table and
// are pressed in test/routes/home/components/ViewModeToggle.dom.test.tsx.
import { describe, expect, test } from "vitest";
import { prefs, readPref, type StorageLike, writePref } from "../../src/lib/prefs";

/** A plain in-memory Storage-like, for round-trip tests. */
function memoryStorage(): StorageLike & { size: () => number } {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    size: () => map.size,
  };
}

/** A storage whose every method throws, for the "storage is unavailable" cases. */
function throwingStorage(): StorageLike {
  return {
    getItem: () => {
      throw new DOMException("blocked", "SecurityError");
    },
    setItem: () => {
      throw new DOMException("blocked", "SecurityError");
    },
  };
}

describe("the table", () => {
  test("names every preference with its key, its fallback and what it accepts", () => {
    expect(Object.entries(prefs).map(([name, pref]) => [name, pref.key, pref.fallback])).toEqual([
      ["viewMode", "garnish.viewMode", "grid"],
      ["ingredientMode", "garnish.ingredientMode", "structured"],
      ["theme", "theme", "system"],
    ]);
    expect(prefs.viewMode.isValid("list")).toBe(true);
    expect(prefs.viewMode.isValid("carousel")).toBe(false);
    expect(prefs.ingredientMode.isValid("summary")).toBe(true);
    expect(prefs.theme.isValid("blue")).toBe(false);
  });

  test("every key is distinct, so setting one never disturbs another", () => {
    const storage = memoryStorage();
    writePref(storage, prefs.viewMode, "list");
    writePref(storage, prefs.ingredientMode, "summary");
    writePref(storage, prefs.theme, "dark");
    expect(storage.size()).toBe(3);
    expect(readPref(storage, prefs.viewMode)).toBe("list");
    expect(readPref(storage, prefs.ingredientMode)).toBe("summary");
    expect(readPref(storage, prefs.theme)).toBe("dark");
  });
});

describe("readPref and writePref", () => {
  test("unset reads as the fallback", () => {
    expect(readPref(memoryStorage(), prefs.viewMode)).toBe("grid");
    expect(readPref(memoryStorage(), prefs.ingredientMode)).toBe("structured");
    expect(readPref(memoryStorage(), prefs.theme)).toBe("system");
  });

  test("round-trips", () => {
    const storage = memoryStorage();
    writePref(storage, prefs.viewMode, "list");
    expect(readPref(storage, prefs.viewMode)).toBe("list");
    writePref(storage, prefs.theme, "dark");
    writePref(storage, prefs.theme, "light");
    expect(readPref(storage, prefs.theme)).toBe("light");
  });

  test("malformed or unexpected content reads as the fallback", () => {
    const storage = memoryStorage();
    storage.setItem("garnish.viewMode", "not json{");
    expect(readPref(storage, prefs.viewMode)).toBe("grid");
    storage.setItem("garnish.viewMode", JSON.stringify("carousel"));
    expect(readPref(storage, prefs.viewMode)).toBe("grid");
    storage.setItem("theme", JSON.stringify("blue"));
    expect(readPref(storage, prefs.theme)).toBe("system");
  });

  test("a throwing storage reads as the fallback and never throws on write", () => {
    const storage = throwingStorage();
    expect(readPref(storage, prefs.viewMode)).toBe("grid");
    expect(() => writePref(storage, prefs.viewMode, "list")).not.toThrow();
  });

  test("the theme uses the key and encoding the design system's bootstrapTheme reads", () => {
    const storage = memoryStorage();
    writePref(storage, prefs.theme, "dark");
    expect(storage.getItem("theme")).toBe('"dark"');
  });
});
