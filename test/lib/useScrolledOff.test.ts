// M24.6: the decision behind the phone's "Ingredients" button — has the aside
// scrolled off? The hook itself is a thin IntersectionObserver wrapper (there
// is no DOM under vitest); the pure decision carries the behaviour.
import { describe, expect, test } from "vitest";
import { isScrolledOff } from "../../src/lib/useScrolledOff";

describe("isScrolledOff", () => {
  test("an intersecting element is on screen", () => {
    expect(isScrolledOff([{ isIntersecting: true }])).toBe(false);
  });

  test("a non-intersecting element has scrolled off", () => {
    expect(isScrolledOff([{ isIntersecting: false }])).toBe(true);
  });

  test("no entries at all counts as scrolled off, so the button is reachable", () => {
    expect(isScrolledOff([])).toBe(true);
  });

  test("any intersecting entry is enough to be on screen", () => {
    expect(isScrolledOff([{ isIntersecting: false }, { isIntersecting: true }])).toBe(false);
  });
});
