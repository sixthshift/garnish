import { describe, expect, test } from "vitest";
import { tagSuggestions, tickedTags } from "../../../src/domain/draft";
import type { Tag } from "../../../src/domain/reference";

const tag = (name: string): Tag => ({ id: name, name, slug: name.toLowerCase() });
const known = [tag("Chinese"), tag("Weeknight"), tag("Vegetarian")];

describe("tagSuggestions on a site's keywords", () => {
  test("a tag the household has comes ticked, under the household's spelling", () => {
    const { suggested } = tagSuggestions(["chinese", "WEEKNIGHT"], "Tomato Egg Stir-fry", known);
    expect(suggested).toEqual([
      { name: "Chinese", known: true, ticked: true },
      { name: "Weeknight", known: true, ticked: true },
    ]);
  });

  test("a new tag is offered unticked", () => {
    expect(tagSuggestions(["stir-fry", "easy"], "Beef and Broccoli", known).suggested).toEqual([
      { name: "Stir-fry", known: false, ticked: false },
      { name: "Easy", known: false, ticked: false },
    ]);
  });

  // The keywords seen on the household's real imports.
  test("a phrase that only repeats the recipe's name is left out", () => {
    const result = tagSuggestions(["Tuscan Chicken", "Marry Me Chicken"], "Creamy Tuscan Chicken", known);
    expect(result.leftOut).toEqual(["Tuscan Chicken"]);
    expect(result.suggested.map((s) => s.name)).toEqual(["Marry Me Chicken"]);
    expect(tagSuggestions(["chocolate chip cookies"], "Chewy Chocolate Chip Cookies", known).leftOut).toEqual(["Chocolate chip cookies"]);
    expect(tagSuggestions(["sauteed green beans"], "Sautéed Green Beans with Garlic", known).leftOut).toEqual(["Sauteed green beans"]);
  });

  test("one word stays even when the name has it: it is a category", () => {
    expect(tagSuggestions(["tomato", "egg"], "Chinese Tomato Egg Stir-fry", known).suggested.map((s) => s.name)).toEqual(["Tomato", "Egg"]);
  });

  test("anything saying recipe, or long enough to be a search phrase, is left out", () => {
    const result = tagSuggestions(
      ["Tuscan Chicken Recipe", "green beans recipe", "McDonald's Sausage and Egg McMuffin recipe", "best ever slow cooker beef for winter"],
      "Something Else",
      known
    );
    expect(result.suggested).toEqual([]);
    expect(result.leftOut).toHaveLength(4);
  });

  test("a known tag is kept even when it repeats the name: the household chose it", () => {
    expect(tagSuggestions(["vegetarian"], "Vegetarian Lasagne", known).suggested).toEqual([{ name: "Vegetarian", known: true, ticked: true }]);
  });

  test("splits commas and keeps each tag once", () => {
    expect(tagSuggestions(["chinese, easy", "Easy"], "Fried Rice", known).suggested.map((s) => s.name)).toEqual(["Chinese", "Easy"]);
  });
});

describe("tagSuggestions on the household's own export", () => {
  test("every tag comes ticked, new or known, and none is left out", () => {
    const result = tagSuggestions(["Weeknight", "Tuscan Chicken Recipe", "Slow cooker"], "Creamy Tuscan Chicken", known, true);
    expect(result.leftOut).toEqual([]);
    expect(tickedTags(result)).toEqual(["Weeknight", "Tuscan Chicken Recipe", "Slow cooker"]);
  });
});

test("tickedTags lists what the review starts with", () => {
  expect(tickedTags(tagSuggestions(["chinese", "easy"], "Fried Rice", known))).toEqual(["Chinese"]);
});
