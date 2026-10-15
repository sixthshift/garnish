import { expect, test } from "vitest";
import type { Tag } from "../../../../src/domain/reference";
import { tagOptions } from "../../../../src/routes/recipes/components/TagField";

const tag = (name: string): Tag => ({ id: `id-${name}`, name, slug: name.toLowerCase() });
const known = ["Vegetarian", "Weeknight", "Kid approved", "Slow cooked", "Vegan"].map(tag);

test("finds the household's tags by any part of the name, those starting with it first", () => {
  expect(tagOptions(known, [], "veg").map((o) => o.label)).toEqual(["Vegetarian", "Vegan"]);
  expect(tagOptions(known, [], "ok").map((o) => o.label)).toEqual(["Slow cooked"]);
  expect(tagOptions(known, [], "APPROVED").map((o) => o.label)).toEqual(["Kid approved"]);
});

test("leaves out tags the recipe already has, and offers nothing for an empty field", () => {
  expect(tagOptions(known, [tag("Vegan")], "veg").map((o) => o.label)).toEqual(["Vegetarian"]);
  expect(tagOptions(known, [], "  ")).toEqual([]);
});

test("offers at most eight", () => {
  const many = Array.from({ length: 12 }, (_, i) => tag(`Tag ${i}`));
  expect(tagOptions(many, [], "tag")).toHaveLength(8);
});
