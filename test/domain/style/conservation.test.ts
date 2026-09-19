// The conservation half of the restyle check: the conditions a rewrite may not
// drop, and the report of the author's words it no longer uses. The cases are
// the ones the lab found on a real ragu, where every number survived and the
// method still changed.
import { describe, expect, test } from "vitest";
import { conditionsOf, contentWordsOf, droppedWords, missingConditions } from "../../../src/domain/style/conservation";
import { factsOf } from "../../../src/domain/style/facts";
import { checkPart, type OriginalPart, type RestyledPart } from "../../../src/domain/style/restyleCheck";
import { restyledPart } from "../../helpers/restyle";

const markers = (prose: string[]) => conditionsOf(prose).map((condition) => condition.marker);

describe("conditionsOf", () => {
  const cases: [string, string, string[]][] = [
    ["an if", "Add 1/2 tsp sugar if the sauce is sour.", ["if"]],
    ["an until", "Cook until the beef is tender.", ["until"]],
    ["an or until, which is not an until", "Cook for 2 hours or until tender.", ["or until"]],
    ["a when", "When the pasta is ready, drain it.", ["when"]],
    ["a while", "Heat while the pasta cooks.", ["while"]],
    ["an once", "Once cooked, shred the beef.", ["once"]],
    ["an unless", "Leave the lid on unless the sauce is thin.", ["unless"]],
    ["an as soon as", "Serve as soon as it is tossed.", ["as soon as"]],
    ["two of a kind are two conditions", "If it is thick, loosen it; if it is thin, reduce it.", ["if", "if"]],
    ["none at all", "Add the garlic and onion and sauté for 2 minutes.", []],
  ];
  for (const [name, step, expected] of cases) {
    test(name, () => expect(markers([step])).toEqual(expected));
  }

  test("a marker inside a word is not a condition", () => {
    expect(markers(["Sift the flour and set it aside."])).toEqual([]);
  });

  test("the phrase is the author's clause, cut at the sentence", () => {
    expect(conditionsOf(["Add sugar if the sauce is sour. Serve."])[0]?.phrase).toBe("if the sauce is sour");
  });

  test("a long clause is cut to six words", () => {
    expect(conditionsOf(["Toss if it gets too thick and heavy and claggy and dull"])[0]?.phrase).toBe("if it gets too thick and heavy");
  });
});

describe("missingConditions", () => {
  const lost = (before: string[], after: string[]) => missingConditions(conditionsOf(before), conditionsOf(after));

  test("a condition that survives reworded is kept", () => {
    expect(lost(["Add sugar if the sauce is sour."], ["If it tastes sharp, add sugar."])).toEqual([]);
  });

  test("a dropped condition is reported as the author wrote it", () => {
    expect(lost(["Add 1/2 tsp sugar if the sauce is sour."], ["Add 1/2 tsp sugar."])).toEqual(["if the sauce is sour"]);
  });

  test("an or until narrowed to an until is a lost condition", () => {
    expect(lost(["Cook for 2 hours or until tender."], ["Cook for 2 hours until tender."])).toEqual(["or until tender"]);
  });

  test("two conditions need two back", () => {
    expect(lost(["If it thickens, loosen it. If it splits, whisk it."], ["If it thickens, loosen it."])).toEqual(["if it splits, whisk it"]);
  });

  test("a condition the rewrite adds is not a loss", () => {
    expect(lost(["Cook the beef."], ["Cook the beef until tender."])).toEqual([]);
  });
});

describe("contentWordsOf", () => {
  test("grammar and pronouns are free", () => {
    expect(contentWordsOf(["I use it for you and then we go."]).map((word) => word.text)).toEqual(["use"]);
  });

  test("numbers belong to the facts check", () => {
    expect(contentWordsOf(["Bake 20 minutes at 180C."]).map((word) => word.text)).toEqual(["bake", "minutes"]);
  });

  const folds: [string, string, boolean][] = [
    ["a plural folds to its singular", "juices juice", true],
    ["an -ies plural folds", "berries berry", true],
    ["an -ing folds to its stem", "seasoning season", true],
    ["an -ed folds to its stem", "marbled marble", true],
    ["a word that merely ends in s does not fold", "gas ga", false],
  ];
  for (const [name, pair, same] of folds) {
    const [a, b] = pair.split(" ") as [string, string];
    test(name, () => expect(contentWordsOf([a])[0]?.key === contentWordsOf([b])[0]?.key).toBe(same));
  }

  test("the spelling shown is the author's, not the stem", () => {
    expect(contentWordsOf(["Including the pooled juices."]).map((word) => word.text)).toEqual(["including", "pooled", "juices"]);
  });

  test("a repeated word is listed once", () => {
    expect(contentWordsOf(["Toss the pasta, then toss again."]).map((word) => word.text)).toEqual(["toss", "pasta", "again"]);
  });
});

describe("droppedWords", () => {
  const dropped = (before: string, after: string) => droppedWords(contentWordsOf([before]), contentWordsOf([after]));

  test("reports what the rewrite no longer says", () => {
    expect(dropped("Return the beef with the pooled juices.", "Return the beef.")).toEqual(["pooled", "juices"]);
  });

  test("a reworded inflection is not a drop", () => {
    expect(dropped("Season the beef.", "Seasoning the beef.")).toEqual([]);
  });
});

describe("checkPart, with conditions", () => {
  // The ragu's seasoning step: the current guide turned "add sugar if the sauce
  // is sour" into "add sugar", and every number and food survived it.
  const original: OriginalPart = {
    name: "",
    ingredients: [{ food: { name: "sugar", pluralName: null }, originalText: "1/2 tsp sugar" }],
    steps: [{ text: "Add 1/2 tsp sugar if the sauce is a bit sour for your taste." }],
  };
  const restyled: RestyledPart = restyledPart("", ["Add 1/2 tsp sugar."], 1);

  test("fails the part, where the facts and the foods both pass", () => {
    const check = checkPart(original, restyled);
    expect(check.missingFacts).toEqual([]);
    expect(check.missingFoods).toEqual([]);
    expect(check.missingConditions).toEqual(["if the sauce is a bit sour"]);
    expect(check.ok).toBe(false);
  });

  test("reports the words it lost without failing on them", () => {
    expect(checkPart(original, restyled).droppedWords).toEqual(["sauce", "bit", "sour", "taste"]);
  });

  test("a rewrite that keeps the condition passes", () => {
    const kept: RestyledPart = restyledPart("", ["If the sauce tastes a bit sour, add 1/2 tsp sugar."], 1);
    expect(checkPart(original, kept).ok).toBe(true);
  });
});

describe("missingConditions names the clause that actually went", () => {
  const lost = (before: string[], after: string[]) => missingConditions(conditionsOf(before), conditionsOf(after));

  test("with two conditions of one marker, the one dropped is the one reported", () => {
    expect(lost(["If your ragu is already warm, skip this step.", "If it gets too thick, loosen it."], ["If it gets too thick, loosen it."])).toEqual([
      "if your ragu is already warm, skip",
    ]);
  });

  test("the surviving one is matched however it was reworded", () => {
    expect(lost(["If your ragu is already warm, skip this step.", "If it gets too thick, loosen it."], ["Loosen it if the ragu gets too thick."])).toEqual([
      "if your ragu is already warm, skip",
    ]);
  });
});

describe("a metric and imperial pair is one quantity written twice", () => {
  const original: OriginalPart = {
    name: "",
    ingredients: [{ originalText: "800g / 28oz crushed tomatoes", note: "" }],
    steps: [{ text: "Heat the oven to 350°F (180°C) and bake for 20 minutes." }],
  };

  test("dropping the imperial half passes: the metric statement asks for exactly that", () => {
    const check = checkPart(original, restyledPart("", ["Heat the oven to 180°C and bake for 20 minutes."], 1));
    expect(check.missingFacts).toEqual([]);
    expect(check.ok).toBe(true);
  });

  test("dropping the metric half still fails: it is the one the household keeps", () => {
    const check = checkPart(original, restyledPart("", ["Heat the oven to 350°F and bake for 20 minutes."], 1));
    expect(check.missingFacts).toEqual(["180c"]);
    expect(check.ok).toBe(false);
  });

  test("an imperial figure with no metric twin in its step is a quantity of its own", () => {
    const lone: OriginalPart = { name: "", ingredients: [], steps: [{ text: "Preheat to 425F." }] };
    expect(checkPart(lone, restyledPart("", ["Preheat the oven."])).missingFacts).toEqual(["425f"]);
  });

  test("grams beside ounces pair the same way", () => {
    const rows: OriginalPart = { name: "", ingredients: [], steps: [{ text: "Add 800g / 28oz crushed tomatoes." }] };
    expect(checkPart(rows, restyledPart("", ["Add the crushed tomatoes, 800g."])).missingFacts).toEqual([]);
  });
});

describe("optionality belongs to the ingredient row", () => {
  const original: OriginalPart = {
    name: "",
    ingredients: [{ originalText: "2 tbsp fish sauce", note: "" }],
    steps: [{ text: "Add the fish sauce (if using) and simmer for 5 minutes." }],
  };

  test("an (if using) the rewrite marked optional on the row is not a lost condition", () => {
    const moved = { name: "", notes: ["optional"], steps: [{ title: "", text: "Add the fish sauce and simmer for 5 minutes.", summary: "" }] };
    expect(checkPart(original, moved).missingConditions).toEqual([]);
  });

  test("an (if using) that went nowhere still fails", () => {
    expect(checkPart(original, restyledPart("", ["Add the fish sauce and simmer for 5 minutes."], 1)).missingConditions).toEqual(["if using"]);
  });

  test("any other condition has nowhere else to live, optional notes or not", () => {
    const cue: OriginalPart = { name: "", ingredients: [{ originalText: "1 onion", note: "" }], steps: [{ text: "Fry until the onion is golden." }] };
    const gone = { name: "", notes: ["optional"], steps: [{ title: "", text: "Fry the onion for 5 minutes.", summary: "" }] };
    expect(checkPart(cue, gone).missingConditions).toEqual(["until the onion is golden"]);
  });
});

describe("a step's own number is not a quantity", () => {
  const cases: [string, string[]][] = [
    ["1. For the miso marinade, simmer 5 minutes.", ["5min"]],
    ["2) Coat the fish and leave 30 minutes.", ["30min"]],
    ["2 tbsp of the oil, warmed.", ["2tbsp"]],
    ["4. Preheat the oven to 220°C.", ["220c"]],
  ];
  for (const [step, expected] of cases) {
    test(step, () => expect(factsOf([step])).toEqual(expected));
  }

  test("an imported method that numbered itself passes when the rewrite drops the numbers", () => {
    const original: OriginalPart = {
      name: "",
      ingredients: [],
      steps: [{ text: "1. Simmer for 5 minutes." }, { text: "2. Preheat the oven to 220°C." }],
    };
    expect(checkPart(original, restyledPart("", ["Simmer for 5 minutes.", "Preheat the oven to 220°C."])).ok).toBe(true);
  });
});
