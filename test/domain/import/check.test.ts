// M36.5: the check that decides whether an anchored read kept the page's
// content. Everything here is the pure comparison — what it forgives
// (reordering, re-parting, entities, whitespace) and what it does not (a
// dropped line, an added one, a reworded step).
import { describe, expect, test } from "vitest";
import { checkAgainstAnchor, normaliseForCheck } from "../../../src/domain/import/check";
import type { ScrapedPart } from "../../../src/domain/import/scraped/types";

const ANCHOR: { parts: ScrapedPart[] } = {
  parts: [
    {
      name: "",
      ingredients: ["1 cup plain flour", "125 g butter", "2 tbsp golden syrup"],
      steps: ["Rub the butter in.", "Melt the syrup.", "Bake for 15 minutes."],
    },
  ],
};

/** The same content, sorted into parts: the answer the anchored read exists to get. */
const REPARTED: { parts: ScrapedPart[] } = {
  parts: [
    { name: "", ingredients: ["1 cup plain flour"], steps: ["Bake for 15 minutes."] },
    { name: "Syrup", ingredients: ["2 tbsp golden syrup", "125 g butter"], steps: ["Melt the syrup.", "Rub the butter in."] },
  ],
};

describe("normaliseForCheck", () => {
  const cases: [string, string, string][] = [
    ["decodes a named entity", "salt &amp; pepper", "salt & pepper"],
    ["decodes a numeric entity", "caster sugar&#x2019;s weight", "caster sugar’s weight"],
    ["collapses runs of whitespace", "1 cup   plain\n\tflour", "1 cup plain flour"],
    ["trims the ends", "  125 g butter\n", "125 g butter"],
    ["leaves case alone", "Bake", "Bake"],
  ];
  for (const [name, input, expected] of cases) {
    test(name, () => expect(normaliseForCheck(input)).toBe(expected));
  }
});

describe("checkAgainstAnchor", () => {
  const cases: [string, { parts: ScrapedPart[] }, Partial<ReturnType<typeof checkAgainstAnchor>>][] = [
    ["the anchor against itself passes", ANCHOR, { ok: true }],
    ["reordered into parts passes: order and part membership are not compared", REPARTED, { ok: true }],
    [
      "entity and whitespace differences pass",
      {
        parts: [
          {
            name: "",
            ingredients: ["1 cup  plain flour ", "125 g butter", "2 tbsp golden syrup"],
            steps: ["Rub the butter in.", "Melt the syrup.", "Bake for\n15 minutes."],
          },
        ],
      },
      { ok: true },
    ],
    [
      "one dropped line fails, naming it",
      { parts: [{ name: "", ingredients: ["1 cup plain flour", "125 g butter"], steps: ANCHOR.parts[0]!.steps }] },
      { ok: false, missingLines: ["2 tbsp golden syrup"], addedLines: [] },
    ],
    [
      "an invented line fails, naming it",
      {
        parts: [{ name: "", ingredients: [...ANCHOR.parts[0]!.ingredients, "a pinch of salt"], steps: ANCHOR.parts[0]!.steps }],
      },
      { ok: false, missingLines: [], addedLines: ["a pinch of salt"] },
    ],
    [
      "a reworded step fails on both sides",
      {
        parts: [
          {
            name: "",
            ingredients: ANCHOR.parts[0]!.ingredients,
            steps: ["Rub the butter in.", "Melt the syrup.", "Bake for 15 mins."],
          },
        ],
      },
      { ok: false, missingSteps: ["Bake for 15 minutes."], addedSteps: ["Bake for 15 mins."] },
    ],
    [
      "a case change is a reword, not noise",
      {
        parts: [{ name: "", ingredients: ["1 cup Plain Flour", "125 g butter", "2 tbsp golden syrup"], steps: ANCHOR.parts[0]!.steps }],
      },
      { ok: false, missingLines: ["1 cup plain flour"], addedLines: ["1 cup Plain Flour"] },
    ],
    [
      "an empty answer is every line and every step missing",
      { parts: [{ name: "", ingredients: [], steps: [] }] },
      { ok: false, missingLines: ANCHOR.parts[0]!.ingredients, missingSteps: ANCHOR.parts[0]!.steps },
    ],
  ];

  for (const [name, answer, expected] of cases) {
    test(name, () => expect(checkAgainstAnchor(answer, ANCHOR)).toMatchObject(expected));
  }

  test("a line the anchor holds twice must appear twice", () => {
    const twice = { parts: [{ name: "", ingredients: ["salt", "salt"], steps: [] }] };
    const once = { parts: [{ name: "", ingredients: ["salt"], steps: [] }] };
    expect(checkAgainstAnchor(twice, twice).ok).toBe(true);
    expect(checkAgainstAnchor(once, twice)).toMatchObject({ ok: false, missingLines: ["salt"], addedLines: [] });
    expect(checkAgainstAnchor(twice, once)).toMatchObject({ ok: false, missingLines: [], addedLines: ["salt"] });
  });

  test("ingredients and steps are compared separately: a step moved into the ingredients fails", () => {
    const swapped = { parts: [{ name: "", ingredients: ["Bake."], steps: ["salt"] }] };
    const straight = { parts: [{ name: "", ingredients: ["salt"], steps: ["Bake."] }] };
    expect(checkAgainstAnchor(swapped, straight)).toMatchObject({
      ok: false,
      missingLines: ["salt"],
      addedLines: ["Bake."],
      missingSteps: ["Bake."],
      addedSteps: ["salt"],
    });
  });
});
