// M37.3: the facts check. A restyle may change every word, so these tests are
// about what it may not change — the numbers, and the ingredients the method
// names — and about the normalisation that keeps "180C" and "180°C" one fact.
import { describe, expect, test } from "vitest";
import {
  checkRestyle,
  factsOf,
  foodsMentioned,
  type OriginalPart,
  type RestyledPart,
} from "../../src/domain/restyleCheck";

function food(name: string, pluralName: string | null = null) {
  return { food: { name, pluralName }, originalText: name };
}

const ORIGINAL: OriginalPart = {
  name: "",
  ingredients: [food("butter"), food("golden syrup"), food("onion", "onions"), food("bay leaf", "bay leaves")],
  steps: [
    { text: "Heat the oven to 180°C." },
    { text: "Melt 125 g of butter with 2 tbsp golden syrup." },
    { text: "Add the onions and bake for 20 minutes." },
  ],
};

/** The three steps as one: statement (2) of the style guide, and it must pass. */
const MERGED: RestyledPart = {
  name: "",
  steps: ["Heat the oven to 180C. Melt 125g butter with 2 tbsp golden syrup, add the onion and bake 20 min."],
};

/** The same content as six micro-steps: statement (1), and it must pass too. */
const SPLIT: RestyledPart = {
  name: "",
  steps: ["Heat the oven to 180°C.", "Melt 125 g butter.", "Stir in 2 tbsp golden syrup.", "Add the onions.", "Bake for 20 minutes."],
};

describe("factsOf", () => {
  const cases: [string, string, string[]][] = [
    ["a temperature with a degree sign", "Heat to 180°C.", ["180c"]],
    ["the same temperature without one", "Heat to 180C.", ["180c"]],
    ["the same temperature spaced", "Heat to 180 C.", ["180c"]],
    ["a time in long form", "Bake for 20 minutes.", ["20min"]],
    ["a time in short form", "Bake for 20 min.", ["20min"]],
    ["a time abbreviated with an s", "Bake for 20 mins.", ["20min"]],
    ["hours fold to h", "Rest 2 hours.", ["2h"]],
    ["a decimal keeps its point", "Weigh 1.25kg.", ["1.25kg"]],
    ["a spelled unit folds", "Weigh 1.25 kilograms.", ["1.25kg"]],
    ["an ASCII fraction", "Add 1/2 cup of milk.", ["1/2cup"]],
    ["a glyph fraction is the same fact", "Add ½ cup of milk.", ["1/2cup"]],
    ["a range gives both ends with the unit", "Bake 5-7 minutes.", ["5min", "7min"]],
    ["a written range gives both ends", "Bake 5 to 7 minutes.", ["5min", "7min"]],
    ["a number with a word that is not a unit stands alone", "Cut into 4 pieces.", ["4"]],
    ["a repeated number is a repeated fact", "Add 2 tbsp, then 2 tbsp more.", ["2tbsp", "2tbsp"]],
    ["no numbers is no facts", "Season to taste.", []],
  ];
  for (const [name, step, expected] of cases) {
    test(name, () => expect(factsOf([step])).toEqual(expected));
  }

  test("gathers across steps in order", () => {
    expect(factsOf(["Heat to 180°C.", "Bake 20 minutes."])).toEqual(["180c", "20min"]);
  });
});

describe("foodsMentioned", () => {
  const rows = [food("butter"), food("onion", "onions"), food("plain flour")];

  test("matches a name as a whole word", () => expect(foodsMentioned(["Melt the butter."], rows)).toEqual(["butter"]));
  test("matches a plural", () => expect(foodsMentioned(["Add the onions."], rows)).toEqual(["onion"]));
  test("matches case insensitively", () => expect(foodsMentioned(["Butter the tin."], rows)).toEqual(["butter"]));
  test("matches a multi-word name", () => expect(foodsMentioned(["Sift the plain flour."], rows)).toEqual(["plain flour"]));
  test("does not match inside a word", () => expect(foodsMentioned(["Use buttermilk."], rows)).toEqual([]));
  test("ignores a row with no food", () => expect(foodsMentioned(["Add salt."], [{ originalText: "salt to taste" }])).toEqual([]));
});

describe("checkRestyle", () => {
  const cases: [string, RestyledPart, Partial<ReturnType<typeof checkRestyle>["parts"][number]>][] = [
    ["the original against itself passes", { name: "", steps: ORIGINAL.steps.map((s) => s.text) }, { ok: true }],
    ["a merged step passes, and 180C matches 180°C", MERGED, { ok: true, missingFacts: [], missingFoods: [] }],
    ["a split step passes", SPLIT, { ok: true, missingFacts: [], missingFoods: [] }],
    [
      "a dropped temperature fails, naming the fact",
      { name: "", steps: ["Heat the oven.", "Melt 125 g butter with 2 tbsp golden syrup.", "Add the onions and bake 20 min."] },
      { ok: false, missingFacts: ["180c"] },
    ],
    [
      "a changed time fails",
      { name: "", steps: ["Heat to 180°C.", "Melt 125 g butter with 2 tbsp golden syrup.", "Add the onions and bake 25 minutes."] },
      { ok: false, missingFacts: ["20min"], addedNumbers: ["25min"] },
    ],
    [
      "a renamed food fails, naming the food",
      { name: "", steps: ["Heat to 180°C.", "Melt 125 g butter with 2 tbsp golden syrup.", "Add the vegetables and bake 20 min."] },
      { ok: false, missingFoods: ["onion"] },
    ],
    [
      "an extra number is listed, not failed",
      {
        name: "",
        steps: ["Heat to 180°C.", "Melt 125 g butter with 1 of the 2 tbsp golden syrup.", "Add the onions and bake 20 min."],
      },
      { ok: true, addedNumbers: ["1"] },
    ],
  ];

  for (const [name, restyled, expected] of cases) {
    test(name, () => {
      const result = checkRestyle([ORIGINAL], [restyled]);
      expect(result.parts).toHaveLength(1);
      expect(result.parts[0]).toMatchObject({ name: "", ...expected });
      expect(result.ok).toBe(expected.ok ?? true);
    });
  }

  test("a food the original steps never named is not required", () => {
    const original: OriginalPart = {
      name: "",
      ingredients: [food("butter"), food("salt")],
      steps: [{ text: "Melt the butter." }],
    };
    expect(checkRestyle([original], [{ name: "", steps: ["Melt the butter."] }]).ok).toBe(true);
  });

  test("the recipe's verdict is the conjunction, with the parts' lists concatenated", () => {
    const other: OriginalPart = { name: "Sauce", ingredients: [], steps: [{ text: "Simmer 10 minutes." }] };
    const result = checkRestyle([ORIGINAL, other], [MERGED, { name: "Sauce", steps: ["Simmer gently."] }]);
    expect(result.ok).toBe(false);
    expect(result.missingFacts).toEqual(["10min"]);
    expect(result.parts.map((part) => part.ok)).toEqual([true, false]);
  });

  test("a part count mismatch throws: that is the restyle read's malformed case", () => {
    expect(() => checkRestyle([ORIGINAL], [])).toThrow(/1 original parts against 0/);
  });
});


test("a mixed number is one fact, written with a glyph or a fraction", () => {
  expect(factsOf(["Slow cook 2 - 2 1/2 hrs"])).toEqual(["2h", "2 1/2h"]);
  expect(factsOf(["Slow cook for 2 to 2½ hours"])).toEqual(["2h", "2 1/2h"]);
  expect(factsOf(["Add 1 1/4 cups of stock"])).toEqual(["1 1/4cup"]);
});

test("note and step references are pointers, not facts", () => {
  expect(factsOf(["Add 1/2 tsp sugar if sour (Note 6)."])).toEqual(["1/2tsp"]);
  expect(factsOf(["Return the beef (see Note 7) and simmer 30 min, as in Step 5 above."])).toEqual(["30min"]);
  expect(factsOf(["Repeat steps 2 to 4 for the second batch of 6 pieces"])).toEqual(["6"]);
});
