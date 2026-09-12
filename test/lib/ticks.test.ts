// The ticks controller against an in-memory storage, including one that
// throws on every access. Hooks are a thin useState wrapper (same pattern as
// prefs.ts) and are not exercised here; the controller carries all the
// behaviour.
import { describe, expect, test } from "vitest";
import {
  anyTicked,
  clearTicks,
  getTicks,
  isIngredientTicked,
  isStepTicked,
  setIngredientTicked,
  setStepTicked,
  subscribeTicks,
  toggleIngredientTicked,
  toggleStepTicked,
  type StorageLike,
} from "../../src/lib/ticks";

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

const RECIPE = "11111111-1111-4111-8111-111111111111";
const OTHER_RECIPE = "22222222-2222-4222-8222-222222222222";
const ING_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ING_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STEP_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("getTicks", () => {
  test("is empty for a recipe with nothing stored", () => {
    expect(getTicks(memoryStorage(), RECIPE)).toEqual({ ingredients: [], steps: [] });
  });

  test("falls back to empty for malformed or unexpected content", () => {
    const storage = memoryStorage();
    storage.setItem("garnish.ticks." + RECIPE, "not json{");
    expect(getTicks(storage, RECIPE)).toEqual({ ingredients: [], steps: [] });
    storage.setItem("garnish.ticks." + RECIPE, JSON.stringify({ ingredients: [1, 2], steps: [] }));
    expect(getTicks(storage, RECIPE)).toEqual({ ingredients: [], steps: [] });
    storage.setItem("garnish.ticks." + RECIPE, JSON.stringify(["not", "an", "object"]));
    expect(getTicks(storage, RECIPE)).toEqual({ ingredients: [], steps: [] });
  });

  test("a throwing storage reads as empty", () => {
    expect(getTicks(throwingStorage(), RECIPE)).toEqual({ ingredients: [], steps: [] });
  });
});

describe("ingredient ticks", () => {
  test("set, read back, and unset", () => {
    const storage = memoryStorage();
    expect(isIngredientTicked(storage, RECIPE, ING_A)).toBe(false);

    setIngredientTicked(storage, RECIPE, ING_A, true);
    expect(isIngredientTicked(storage, RECIPE, ING_A)).toBe(true);
    expect(isIngredientTicked(storage, RECIPE, ING_B)).toBe(false);

    setIngredientTicked(storage, RECIPE, ING_A, false);
    expect(isIngredientTicked(storage, RECIPE, ING_A)).toBe(false);
  });

  test("setting true twice does not duplicate the id", () => {
    const storage = memoryStorage();
    setIngredientTicked(storage, RECIPE, ING_A, true);
    setIngredientTicked(storage, RECIPE, ING_A, true);
    expect(getTicks(storage, RECIPE).ingredients).toEqual([ING_A]);
  });

  test("toggle flips the current state and returns the new state", () => {
    const storage = memoryStorage();
    const first = toggleIngredientTicked(storage, RECIPE, ING_A);
    expect(first.ingredients).toEqual([ING_A]);
    const second = toggleIngredientTicked(storage, RECIPE, ING_A);
    expect(second.ingredients).toEqual([]);
  });

  test("ingredient and step state do not collide", () => {
    const storage = memoryStorage();
    setIngredientTicked(storage, RECIPE, ING_A, true);
    setStepTicked(storage, RECIPE, STEP_A, true);
    expect(getTicks(storage, RECIPE)).toEqual({ ingredients: [ING_A], steps: [STEP_A] });
  });

  test("different recipes are stored independently", () => {
    const storage = memoryStorage();
    setIngredientTicked(storage, RECIPE, ING_A, true);
    expect(isIngredientTicked(storage, OTHER_RECIPE, ING_A)).toBe(false);
    expect(storage.size()).toBe(1);
  });

  test("a throwing storage never throws on write and reads back as untouched", () => {
    const storage = throwingStorage();
    expect(() => setIngredientTicked(storage, RECIPE, ING_A, true)).not.toThrow();
    expect(isIngredientTicked(storage, RECIPE, ING_A)).toBe(false);
  });
});

describe("step ticks", () => {
  test("set, read back, unset and toggle", () => {
    const storage = memoryStorage();
    expect(isStepTicked(storage, RECIPE, STEP_A)).toBe(false);
    setStepTicked(storage, RECIPE, STEP_A, true);
    expect(isStepTicked(storage, RECIPE, STEP_A)).toBe(true);
    toggleStepTicked(storage, RECIPE, STEP_A);
    expect(isStepTicked(storage, RECIPE, STEP_A)).toBe(false);
  });

  test("a throwing storage never throws", () => {
    const storage = throwingStorage();
    expect(() => toggleStepTicked(storage, RECIPE, STEP_A)).not.toThrow();
  });
});

describe("clearTicks", () => {
  test("removes both ingredient and step state for the recipe, leaving others untouched", () => {
    const storage = memoryStorage();
    setIngredientTicked(storage, RECIPE, ING_A, true);
    setStepTicked(storage, RECIPE, STEP_A, true);
    setIngredientTicked(storage, OTHER_RECIPE, ING_B, true);

    clearTicks(storage, RECIPE);

    expect(getTicks(storage, RECIPE)).toEqual({ ingredients: [], steps: [] });
    expect(isIngredientTicked(storage, OTHER_RECIPE, ING_B)).toBe(true);
  });

  test("a throwing storage never throws", () => {
    expect(() => clearTicks(throwingStorage(), RECIPE)).not.toThrow();
  });
});

describe("anyTicked", () => {
  test("false for a recipe with nothing ticked", () => {
    expect(anyTicked(memoryStorage(), RECIPE)).toBe(false);
  });

  test("true once an ingredient or a step is ticked", () => {
    const storage = memoryStorage();
    setIngredientTicked(storage, RECIPE, ING_A, true);
    expect(anyTicked(storage, RECIPE)).toBe(true);

    const other = memoryStorage();
    setStepTicked(other, RECIPE, STEP_A, true);
    expect(anyTicked(other, RECIPE)).toBe(true);
  });

  test("false again once clearTicks runs, and does not read other recipes", () => {
    const storage = memoryStorage();
    setIngredientTicked(storage, RECIPE, ING_A, true);
    setIngredientTicked(storage, OTHER_RECIPE, ING_B, true);

    clearTicks(storage, RECIPE);

    expect(anyTicked(storage, RECIPE)).toBe(false);
    expect(anyTicked(storage, OTHER_RECIPE)).toBe(true);
  });

  test("a throwing storage reads as nothing ticked", () => {
    expect(anyTicked(throwingStorage(), RECIPE)).toBe(false);
  });
});

describe("subscribeTicks", () => {
  test("every write notifies every listener until it unsubscribes", () => {
    const storage = memoryStorage();
    let seen = 0;
    const unsubscribe = subscribeTicks(() => {
      seen += 1;
    });

    setIngredientTicked(storage, RECIPE, ING_A, true);
    setStepTicked(storage, RECIPE, STEP_A, true);
    clearTicks(storage, RECIPE);
    expect(seen).toBe(3);

    unsubscribe();
    setIngredientTicked(storage, RECIPE, ING_A, true);
    expect(seen).toBe(3);
  });

  test("a throwing storage still notifies: the readers re-read and find nothing changed", () => {
    let seen = 0;
    const unsubscribe = subscribeTicks(() => {
      seen += 1;
    });
    setIngredientTicked(throwingStorage(), RECIPE, ING_A, true);
    unsubscribe();
    expect(seen).toBe(1);
  });
});
