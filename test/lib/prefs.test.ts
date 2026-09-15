// The prefs controller against an in-memory storage, including one that
// throws on every access. Hooks are a thin useState wrapper (same pattern as
// useWakeLock/useOnline) and are not exercised here; the controller carries
// all the behaviour.
import { describe, expect, test } from "vitest";
import {
  getIngredientMode,
  getScreenAwake,
  getSort,
  getTheme,
  getViewMode,
  type StorageLike,
  setIngredientMode,
  setScreenAwake,
  setSort,
  setTheme,
  setViewMode,
} from "../../src/lib/prefs";

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

describe("view mode", () => {
  test("defaults to grid when unset", () => {
    expect(getViewMode(memoryStorage())).toBe("grid");
  });

  test("round-trips", () => {
    const storage = memoryStorage();
    setViewMode(storage, "list");
    expect(getViewMode(storage)).toBe("list");
  });

  test("falls back to the default for malformed or unexpected content", () => {
    const storage = memoryStorage();
    storage.setItem("garnish.viewMode", "not json{");
    expect(getViewMode(storage)).toBe("grid");
    storage.setItem("garnish.viewMode", JSON.stringify("carousel"));
    expect(getViewMode(storage)).toBe("grid");
  });

  test("a throwing storage reads as the default and never throws on write", () => {
    const storage = throwingStorage();
    expect(getViewMode(storage)).toBe("grid");
    expect(() => setViewMode(storage, "list")).not.toThrow();
  });
});

describe("sort", () => {
  test("defaults to name/asc", () => {
    expect(getSort(memoryStorage())).toEqual({ key: "name", dir: "asc" });
  });

  test("round-trips every key and direction", () => {
    const storage = memoryStorage();
    setSort(storage, { key: "lastMade", dir: "desc" });
    expect(getSort(storage)).toEqual({ key: "lastMade", dir: "desc" });
  });

  test("falls back to the default for a bad key, a bad dir, or the wrong shape", () => {
    const storage = memoryStorage();
    storage.setItem("garnish.sort", JSON.stringify({ key: "az", dir: "asc" }));
    expect(getSort(storage)).toEqual({ key: "name", dir: "asc" });
    storage.setItem("garnish.sort", JSON.stringify({ key: "name", dir: "up" }));
    expect(getSort(storage)).toEqual({ key: "name", dir: "asc" });
    storage.setItem("garnish.sort", JSON.stringify("name"));
    expect(getSort(storage)).toEqual({ key: "name", dir: "asc" });
  });

  test("a throwing storage reads as the default", () => {
    expect(getSort(throwingStorage())).toEqual({ key: "name", dir: "asc" });
  });
});

describe("ingredient mode", () => {
  test("defaults to structured", () => {
    expect(getIngredientMode(memoryStorage())).toBe("structured");
  });

  test("round-trips", () => {
    const storage = memoryStorage();
    setIngredientMode(storage, "summary");
    expect(getIngredientMode(storage)).toBe("summary");
  });

  test("a throwing storage reads as the default", () => {
    expect(getIngredientMode(throwingStorage())).toBe("structured");
  });
});

describe("theme", () => {
  test("defaults to system", () => {
    expect(getTheme(memoryStorage())).toBe("system");
  });

  test("round-trips light and dark", () => {
    const storage = memoryStorage();
    setTheme(storage, "dark");
    expect(getTheme(storage)).toBe("dark");
    setTheme(storage, "light");
    expect(getTheme(storage)).toBe("light");
  });

  test("uses the same key and encoding the design system's bootstrapTheme reads", () => {
    const storage = memoryStorage();
    setTheme(storage, "dark");
    expect(storage.getItem("theme")).toBe('"dark"');
  });

  test("falls back to the default for an unexpected value", () => {
    const storage = memoryStorage();
    storage.setItem("theme", JSON.stringify("blue"));
    expect(getTheme(storage)).toBe("system");
  });

  test("a throwing storage reads as the default", () => {
    expect(getTheme(throwingStorage())).toBe("system");
  });
});

describe("screen awake", () => {
  test("defaults to true", () => {
    expect(getScreenAwake(memoryStorage())).toBe(true);
  });

  test("round-trips false", () => {
    const storage = memoryStorage();
    setScreenAwake(storage, false);
    expect(getScreenAwake(storage)).toBe(false);
  });

  test("falls back to the default for non-boolean content", () => {
    const storage = memoryStorage();
    storage.setItem("garnish.screenAwake", JSON.stringify("no"));
    expect(getScreenAwake(storage)).toBe(true);
  });

  test("a throwing storage reads as the default and never throws on write", () => {
    const storage = throwingStorage();
    expect(getScreenAwake(storage)).toBe(true);
    expect(() => setScreenAwake(storage, false)).not.toThrow();
  });
});

test("each preference has its own key, so setting one never disturbs another", () => {
  const storage = memoryStorage();
  setViewMode(storage, "list");
  setSort(storage, { key: "rating", dir: "desc" });
  setIngredientMode(storage, "summary");
  setTheme(storage, "dark");
  setScreenAwake(storage, false);

  expect(storage.size()).toBe(5);
  expect(getViewMode(storage)).toBe("list");
  expect(getSort(storage)).toEqual({ key: "rating", dir: "desc" });
  expect(getIngredientMode(storage)).toBe("summary");
  expect(getTheme(storage)).toBe("dark");
  expect(getScreenAwake(storage)).toBe(false);
});
