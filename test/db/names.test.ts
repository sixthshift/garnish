import { expect, test } from "vitest";
import { cleanName, slugify, uniqueSlug } from "../../src/db/names";

test("cleanName trims and rejects blank", () => {
  expect(cleanName("  Butter ")).toBe("Butter");
  expect(() => cleanName("   ")).toThrow(/required/);
});

test("slugify lowercases, strips accents and joins with single hyphens", () => {
  expect(slugify("Crème Brûlée!")).toBe("creme-brulee");
  expect(slugify("  Week  Night -- Dinner ")).toBe("week-night-dinner");
  expect(slugify("Butter pasta")).toBe("butter-pasta");
  expect(slugify("$$$")).toBe("");
});

test("uniqueSlug suffixes from -2 until free, and names the nameless", () => {
  const taken = new Set(["pasta", "pasta-2"]);
  expect(uniqueSlug("pasta", (s) => taken.has(s))).toBe("pasta-3");
  expect(uniqueSlug("soup", (s) => taken.has(s))).toBe("soup");
  expect(uniqueSlug("", () => false)).toBe("untitled");
});
