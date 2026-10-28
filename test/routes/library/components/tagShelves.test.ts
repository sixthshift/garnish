import { expect, test } from "vitest";
import type { TagUsage } from "../../../../src/domain/reference";
import { TOP_TAGS, tagShelves, tagsByUse } from "../../../../src/routes/library/components/tagUse";

const tag = (name: string, recipes: number): TagUsage => ({ id: name, name, slug: name.toLowerCase().replace(/ /g, "-"), recipes });
const library = [
  tag("Weeknight", 6),
  tag("Baking", 4),
  tag("Dessert", 3),
  tag("One pot", 3),
  tag("Curry", 2),
  tag("Pasta", 2),
  tag("Vegetarian", 2),
  tag("BBQ", 2),
  tag("Freezer friendly", 1),
  tag("Gluten free", 1),
  tag("Party", 1),
];
const names = (tags: TagUsage[]) => tags.map((t) => t.name);

test("the most used come first, ties by name, and the rest wait behind More", () => {
  const { top, more } = tagShelves(library, [], "");
  expect(top).toHaveLength(TOP_TAGS);
  expect(names(top)).toEqual(["Weeknight", "Baking", "Dessert", "One pot", "BBQ", "Curry", "Pasta", "Vegetarian"]);
  expect(names(more)).toEqual(["Freezer friendly", "Gluten free", "Party"]);
});

test("a selected tag stays up front, so a filter in force never hides", () => {
  const { top, more } = tagShelves(library, ["party"], "");
  expect(names(top)).toContain("Party");
  expect(names(more)).not.toContain("Party");
});

test("finding narrows the rest by any part of the name, in any case", () => {
  expect(names(tagShelves(library, [], "FREE").more)).toEqual(["Freezer friendly", "Gluten free"]);
  expect(tagShelves(library, [], "zzz").more).toEqual([]);
});

test("a short library is all up front, with nothing behind More", () => {
  const { top, more } = tagShelves(library.slice(0, 3), [], "");
  expect(top).toHaveLength(3);
  expect(more).toEqual([]);
});

test("a card's tags come most used first, ties by name", () => {
  const own = [tag("Party", 1), tag("Weeknight", 6), tag("Gluten free", 1)];
  expect(names(tagsByUse(own, library))).toEqual(["Weeknight", "Gluten free", "Party"]);
});
