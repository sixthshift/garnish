// Pure filter-bar helpers (M12.3): folding the legacy `tag` param into
// `tags`, and the small array utilities the food picker uses.
import { describe, expect, test } from "vitest";
import { addUnique, arrayParam, selectedTags, withoutId } from "../../src/domain/recipeFilters";

describe("selectedTags", () => {
  test("folds the legacy singular tag into the array, de-duplicated", () => {
    expect(selectedTags(undefined, undefined)).toEqual([]);
    expect(selectedTags("weeknight", undefined)).toEqual(["weeknight"]);
    expect(selectedTags(undefined, ["pasta"])).toEqual(["pasta"]);
    expect(selectedTags("weeknight", ["pasta"])).toEqual(["weeknight", "pasta"]);
    expect(selectedTags("weeknight", ["weeknight", "pasta"])).toEqual(["weeknight", "pasta"]);
  });

  test("drops blank values", () => {
    expect(selectedTags("  ", [])).toEqual([]);
    expect(selectedTags(undefined, ["", "  ", "pasta"])).toEqual(["pasta"]);
  });
});

describe("arrayParam", () => {
  test("undefined for an empty array so the URL stays clean, else the array", () => {
    expect(arrayParam([])).toBeUndefined();
    expect(arrayParam(["a"])).toEqual(["a"]);
    expect(arrayParam(["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("addUnique", () => {
  test("appends unless already present", () => {
    expect(addUnique([], "a")).toEqual(["a"]);
    expect(addUnique(["a"], "b")).toEqual(["a", "b"]);
    expect(addUnique(["a", "b"], "a")).toEqual(["a", "b"]);
  });
});

describe("withoutId", () => {
  test("removes the id, leaving the rest in order", () => {
    expect(withoutId(["a", "b", "c"], "b")).toEqual(["a", "c"]);
    expect(withoutId(["a"], "missing")).toEqual(["a"]);
    expect(withoutId([], "a")).toEqual([]);
  });
});
