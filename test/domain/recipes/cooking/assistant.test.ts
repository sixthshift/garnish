// The cooking assistant's prompt and the check on its answer (decisions.md row 214).
import { describe, expect, test } from "vitest";
import { AssistantError, assistantPrompt, offerToAdjustment, parseAssistantAnswer, recipeForPrompt } from "../../../../src/domain/recipes/cooking";
import type { Recipe } from "../../../../src/domain/recipes/recipe";

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const food = (name: string) => ({
  id: uid(70 + name.length),
  name,
  pluralName: null,
  aliases: [],
  aisle: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
});
const BEEF = uid(1);
const SALT = uid(2);
const BAY = uid(3);
const SEAR = uid(10);
const SLOW = uid(11);

const recipe = {
  id: uid(100),
  name: "Ragu",
  recipeServings: 4,
  parts: [
    {
      id: uid(200),
      name: "",
      ingredients: [
        {
          id: BEEF,
          quantity: 1000,
          unit: {
            id: uid(50),
            name: "g",
            pluralName: null,
            abbreviation: "g",
            useAbbreviation: true,
            fraction: false,
            portion: false,
            standardQuantity: null,
            standardUnitId: null,
          },
          food: food("chuck beef"),
          note: "",
          originalText: "",
          fixed: false,
          alternatives: [],
        },
        { id: SALT, quantity: null, unit: null, food: food("salt"), note: "to taste", originalText: "", fixed: false, alternatives: [] },
        { id: BAY, quantity: 3, unit: null, food: food("bay leaf"), note: "", originalText: "", fixed: true, alternatives: [] },
      ],
      steps: [
        { id: SEAR, title: "", text: "Sear to brown.", summary: "", ingredientIds: [], image: null },
        { id: SLOW, title: "", text: "Slow cook 2 hrs.", summary: "Lid on.", ingredientIds: [], image: null },
      ],
    },
  ],
} as unknown as Recipe;

const context = { servings: 2, tickedIngredientIds: [BEEF], doneStepIds: [SEAR], nowStepId: SLOW, timers: [{ label: "Slow cook", remaining: "0:24" }] };

describe("the prompt", () => {
  test("shows each line and step by id, with what is got out, done and being cooked", () => {
    const text = recipeForPrompt(recipe, context);
    expect(text).toContain("Recipe: Ragu (cooking for 2)");
    expect(text).toContain(`- [${BEEF}] 1000 g chuck beef (got out)`);
    expect(text).toContain(`[${BAY}] 3 bay leaf (fixed, does not scale)`);
    expect(text).toContain(`1. [${SEAR}] Sear to brown. (done)`);
    expect(text).toContain(`2. [${SLOW}] Slow cook 2 hrs. [tip: Lid on.] ← cooking now`);
    expect(text).toContain("Timers running: Slow cook (0:24 left)");
  });

  test("carries the conversation and the question, and says what may be offered", () => {
    const text = assistantPrompt({
      recipe,
      context,
      history: [
        { role: "cook", text: "no celery?" },
        { role: "assistant", text: "Use carrot." },
      ],
      message: "beef isn't shredding",
    });
    expect(text).toContain("Cook: no celery?\nYou: Use carrot.");
    expect(text).toContain("Cook: beef isn't shredding");
    expect(text).toContain('"swap"');
    expect(text).toContain("Australian English");
  });
});

describe("the answer", () => {
  const factor = 0.5; // the page shows 2 of the recipe's 4

  test("an amount at the page's servings is stored at the recipe's; a fixed line is not scaled", () => {
    expect(offerToAdjustment({ kind: "amount", ingredientId: BEEF, quantity: 400, summary: "Beef 400 g" }, recipe, factor)).toEqual({
      kind: "amount",
      ingredientId: BEEF,
      quantity: 800,
      summary: "Beef 400 g",
    });
    expect(offerToAdjustment({ kind: "amount", ingredientId: BAY, quantity: 2, summary: "2 bay leaves" }, recipe, factor)).toMatchObject({ quantity: 2 });
  });

  test("a swap keeps its amount and unit only when they change", () => {
    expect(offerToAdjustment({ kind: "swap", ingredientId: BEEF, food: "lamb shoulder", quantity: 0, unit: "", summary: "Lamb" }, recipe, factor)).toEqual({
      kind: "swap",
      ingredientId: BEEF,
      food: "lamb shoulder",
      quantity: null,
      unit: null,
      summary: "Lamb",
    });
  });

  test("an offer to a row the recipe does not have, of an unknown kind, or without a summary is dropped", () => {
    expect(offerToAdjustment({ kind: "leave-out", ingredientId: uid(999), summary: "x" }, recipe, factor)).toBeNull();
    expect(offerToAdjustment({ kind: "garnish", ingredientId: BEEF, summary: "x" }, recipe, factor)).toBeNull();
    expect(offerToAdjustment({ kind: "tip", stepId: SEAR, tip: "Batches.", summary: "" }, recipe, factor)).toBeNull();
    expect(offerToAdjustment({ kind: "amount", ingredientId: SALT, quantity: 2, summary: "More salt" }, recipe, factor)).toBeNull();
  });

  test("parseAssistantAnswer keeps the reply and the note, and at most three offers that fit", () => {
    const answer = parseAssistantAnswer(
      JSON.stringify({
        reply: " Give it 30 minutes more. ",
        note: "Beef took 3 hours",
        adjustments: [
          { kind: "step", stepId: SLOW, text: "Slow cook 3 hrs.", summary: "Slow cook 3 hrs", ingredientId: "", quantity: 0, food: "", unit: "", tip: "" },
          { kind: "leave-out", ingredientId: uid(999), summary: "nope" },
        ],
      }),
      recipe,
      factor
    );
    expect(answer).toEqual({
      reply: "Give it 30 minutes more.",
      note: "Beef took 3 hours",
      offers: [{ kind: "step", stepId: SLOW, text: "Slow cook 3 hrs.", summary: "Slow cook 3 hrs" }],
    });
  });

  test("an answer in plain words is still an answer; one that is neither is an error", () => {
    expect(parseAssistantAnswer("Give it ten more minutes.", recipe, 1)).toEqual({ reply: "Give it ten more minutes.", note: "", offers: [] });
    expect(() => parseAssistantAnswer('{"reply": ""}', recipe, 1)).toThrow(AssistantError);
    expect(() => parseAssistantAnswer("{not json", recipe, 1)).toThrow(AssistantError);
  });
});
