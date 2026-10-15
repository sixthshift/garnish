import { describe, expect, test } from "vitest";
import { tagKey, tagName, tagNamesFrom } from "../../../src/domain/reference";

describe("tagName", () => {
  test("capitalises the first letter and keeps the rest as given", () => {
    expect(tagName("weeknight")).toBe("Weeknight");
    expect(tagName("one pot")).toBe("One pot");
    expect(tagName("BBQ")).toBe("BBQ");
    expect(tagName("Thai")).toBe("Thai");
    expect(tagName("crème brûlée")).toBe("Crème brûlée");
  });

  test("collapses whitespace and drops a leading #", () => {
    expect(tagName("  kid   approved \n")).toBe("Kid approved");
    expect(tagName("#weeknight")).toBe("Weeknight");
    expect(tagName("## gluten free")).toBe("Gluten free");
  });

  test("is empty when nothing is left", () => {
    expect(tagName("   ")).toBe("");
    expect(tagName("#")).toBe("");
  });
});

describe("tagKey", () => {
  test("is the same for names that differ only in case, spacing or a leading #", () => {
    expect(tagKey("One Pot")).toBe(tagKey("one  pot"));
    expect(tagKey("#one pot")).toBe(tagKey("ONE POT"));
  });

  test("folds non-ASCII letters, which SQLite's NOCASE does not", () => {
    expect(tagKey("CRÈME")).toBe(tagKey("crème"));
  });

  test("treats composed and decomposed accents as one name", () => {
    expect(tagKey("Crème")).toBe(tagKey("Crème"));
  });
});

describe("tagNamesFrom", () => {
  test("splits on commas, wherever the list came from", () => {
    expect(tagNamesFrom(["dinner, quick", "vegetarian"])).toEqual(["Dinner", "Quick", "Vegetarian"]);
  });

  test("keeps each tag once by key, in first-seen order, with the first spelling", () => {
    expect(tagNamesFrom(["Weeknight", "weeknight", "Pasta", "#WEEKNIGHT"])).toEqual(["Weeknight", "Pasta"]);
  });

  test("drops blanks", () => {
    expect(tagNamesFrom(["", " , ,", "Soup"])).toEqual(["Soup"]);
  });
});
