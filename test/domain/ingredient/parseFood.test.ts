import { describe, expect, test } from "vitest";
import { parseFood, type FoodCandidate } from "../../../src/domain/ingredient/parseFood";

const food = (name: string, pluralName: string | null, aliases: string[] = []): FoodCandidate => ({
  name,
  pluralName,
  aliases,
});

const FLOUR = food("flour", null);
const ONION = food("onion", "onions");
const CHICKEN = food("chicken", "chicken");
const CHICKEN_BREAST = food("chicken breast", "chicken breasts");
const SCALLION = food("spring onion", "spring onions", ["scallion", "green onion"]);

const FOODS = [FLOUR, ONION, CHICKEN, CHICKEN_BREAST, SCALLION];

describe("parseFood", () => {
  describe("matches by name", () => {
    test.each([
      ["flour", FLOUR, ""],
      ["onion", ONION, ""],
    ] as const)("%s", (rest, expected, foodText) => {
      expect(parseFood(rest, FOODS)).toEqual({ food: expected, foodText, note: "" });
    });
  });

  describe("matches by plural", () => {
    test.each([
      ["onions", ONION, ""],
      ["chicken breasts", CHICKEN_BREAST, ""],
    ] as const)("%s", (rest, expected, foodText) => {
      expect(parseFood(rest, FOODS)).toEqual({ food: expected, foodText, note: "" });
    });
  });

  describe("matches by alias", () => {
    test.each([
      ["scallion", SCALLION, ""],
      ["green onion", SCALLION, ""],
    ] as const)("%s", (rest, expected, foodText) => {
      expect(parseFood(rest, FOODS)).toEqual({ food: expected, foodText, note: "" });
    });
  });

  test("matching is case-insensitive", () => {
    expect(parseFood("FLOUR", FOODS)).toEqual({ food: FLOUR, foodText: "", note: "" });
    expect(parseFood("Scallion", FOODS)).toEqual({ food: SCALLION, foodText: "", note: "" });
  });

  describe("longest match wins over two candidate foods", () => {
    test("chicken breast over chicken", () => {
      expect(parseFood("chicken breast", FOODS)).toEqual({ food: CHICKEN_BREAST, foodText: "", note: "" });
    });

    test("the shorter food still matches on its own", () => {
      expect(parseFood("chicken", FOODS)).toEqual({ food: CHICKEN, foodText: "", note: "" });
    });
  });

  describe("comma note", () => {
    test("head and tail split on the first comma", () => {
      expect(parseFood("flour, sifted", FOODS)).toEqual({ food: FLOUR, foodText: "", note: "sifted" });
    });

    test("a second comma stays inside the note", () => {
      expect(parseFood("flour, sifted, cooled", FOODS)).toEqual({ food: FLOUR, foodText: "", note: "sifted, cooled" });
    });

    test("no comma at all leaves the note empty", () => {
      expect(parseFood("flour", FOODS)).toEqual({ food: FLOUR, foodText: "", note: "" });
    });
  });

  describe("parenthetical note", () => {
    test("a parenthetical with no comma lifts into the note", () => {
      expect(parseFood("chicken breast (about 400 g)", FOODS)).toEqual({
        food: CHICKEN_BREAST,
        foodText: "",
        note: "about 400 g",
      });
    });

    test("a parenthetical alongside a comma tail joins it, in text order", () => {
      expect(parseFood("chicken breast (about 400 g), diced", FOODS)).toEqual({
        food: CHICKEN_BREAST,
        foodText: "",
        note: "about 400 g, diced",
      });
    });

    test("an empty parenthetical contributes nothing to the note", () => {
      expect(parseFood("flour ()", FOODS)).toEqual({ food: FLOUR, foodText: "", note: "" });
    });
  });

  describe("the unmatched-adjective case", () => {
    test("an unmatched leading word stays part of foodText rather than being dropped", () => {
      expect(parseFood("plain flour", [FLOUR])).toEqual({ food: null, foodText: "plain flour", note: "" });
    });

    test("the note is still split off an unmatched food", () => {
      expect(parseFood("plain flour, sifted", [FLOUR])).toEqual({ food: null, foodText: "plain flour", note: "sifted" });
    });
  });

  describe("no match", () => {
    test("an empty line", () => {
      expect(parseFood("", [])).toEqual({ food: null, foodText: "", note: "" });
    });

    test("no food in the vocabulary at all", () => {
      expect(parseFood("salt, to taste", [])).toEqual({ food: null, foodText: "salt", note: "to taste" });
    });
  });

  test("trailing text a shorter matched name doesn't cover stays in foodText", () => {
    expect(parseFood("chicken thigh", [CHICKEN])).toEqual({ food: CHICKEN, foodText: "thigh", note: "" });
  });
});
