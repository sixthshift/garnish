// Pure sort helpers (M12.4): default direction resolution, the seeded random
// order and the dice button's pick.
import { describe, expect, test } from "vitest";
import { defaultDir, hash32, newSeed, pickRandom, resolveSort, seededOrder, SORT_OPTIONS } from "../../src/domain/sort";

describe("defaultDir", () => {
  test("name reads ascending; every other key defaults newest/highest first", () => {
    expect(defaultDir("name")).toBe("asc");
    expect(defaultDir("created")).toBe("desc");
    expect(defaultDir("updated")).toBe("desc");
    expect(defaultDir("lastMade")).toBe("desc");
    expect(defaultDir("rating")).toBe("desc");
    expect(defaultDir("random")).toBe("desc");
  });
});

describe("resolveSort", () => {
  test("unset falls back to created, then that key's default direction", () => {
    expect(resolveSort()).toEqual({ key: "created", dir: "desc" });
    expect(resolveSort("name")).toEqual({ key: "name", dir: "asc" });
    expect(resolveSort("rating")).toEqual({ key: "rating", dir: "desc" });
  });

  test("an explicit dir is kept as given", () => {
    expect(resolveSort("name", "desc")).toEqual({ key: "name", dir: "desc" });
    expect(resolveSort("created", "asc")).toEqual({ key: "created", dir: "asc" });
  });
});

describe("SORT_OPTIONS", () => {
  test("covers every key, name/created/updated/lastMade/rating in both directions, random once", () => {
    const byKey = new Map<string, number>();
    for (const option of SORT_OPTIONS) byKey.set(option.key, (byKey.get(option.key) ?? 0) + 1);
    expect(byKey.get("name")).toBe(2);
    expect(byKey.get("created")).toBe(2);
    expect(byKey.get("updated")).toBe(2);
    expect(byKey.get("lastMade")).toBe(2);
    expect(byKey.get("rating")).toBe(2);
    expect(byKey.get("random")).toBe(1);
  });
});

describe("hash32", () => {
  test("deterministic: the same input always hashes the same", () => {
    expect(hash32("seed:id-1")).toBe(hash32("seed:id-1"));
  });

  test("different inputs hash differently (for this sample)", () => {
    const values = ["seed:a", "seed:b", "seed:c", "seed:d", "other-seed:a"];
    const hashes = new Set(values.map(hash32));
    expect(hashes.size).toBe(values.length);
  });
});

describe("seededOrder", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];

  test("same seed reproduces the same order every time", () => {
    expect(seededOrder(rows, "shuffle-1")).toEqual(seededOrder(rows, "shuffle-1"));
  });

  test("keeps the same set of rows, just reordered", () => {
    const ordered = seededOrder(rows, "shuffle-1");
    expect(ordered.map((r) => r.id).sort()).toEqual(rows.map((r) => r.id).sort());
  });

  test("a different seed gives a different order (for this sample)", () => {
    expect(seededOrder(rows, "shuffle-1")).not.toEqual(seededOrder(rows, "shuffle-2"));
  });

  test("does not mutate the input", () => {
    const copy = [...rows];
    seededOrder(rows, "shuffle-1");
    expect(rows).toEqual(copy);
  });
});

describe("newSeed", () => {
  test("returns a non-empty string, different each time", () => {
    const a = newSeed();
    const b = newSeed();
    expect(typeof a).toBe("string");
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});

describe("pickRandom", () => {
  test("undefined for an empty list", () => {
    expect(pickRandom([])).toBeUndefined();
  });

  test("picks by index using the given random source", () => {
    const items = ["a", "b", "c", "d"];
    expect(pickRandom(items, () => 0)).toBe("a");
    expect(pickRandom(items, () => 0.99)).toBe("d");
    expect(pickRandom(items, () => 0.5)).toBe("c");
  });
});
