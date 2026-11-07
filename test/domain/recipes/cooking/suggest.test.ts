// The review's suggestions from a model (decisions.md row 214).
import { expect, test } from "vitest";
import { timerAgainNote } from "../../../../src/domain/recipes/components/cooking/CookingContext";
import { type CookSession, eveningForPrompt, parseSuggestions, SuggestError, suggestPrompt } from "../../../../src/domain/recipes/cooking";
import type { Recipe } from "../../../../src/domain/recipes/recipe";

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CELERY = uid(1);
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
          id: CELERY,
          quantity: 1,
          unit: null,
          food: { id: uid(60), name: "celery", pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false, conversions: [] },
          note: "",
          originalText: "",
          fixed: false,
          alternatives: [],
        },
      ],
      steps: [
        { id: SEAR, title: "", text: "Sear to brown.", summary: "", ingredientIds: [], image: null },
        { id: SLOW, title: "", text: "Slow cook 2 hrs.", summary: "", ingredientIds: [], image: null },
      ],
    },
  ],
} as unknown as Recipe;

const at = "2026-11-07T08:00:00.000Z";
const swap = { id: uid(900), kind: "swap" as const, ingredientId: CELERY, food: "carrot", quantity: null, unit: null, summary: "Celery → carrot" };
const longer = { id: uid(901), kind: "step" as const, stepId: SLOW, text: "Slow cook 3 hrs.", summary: "3 hrs" };
const session: CookSession = {
  id: uid(300),
  recipeId: uid(100),
  servings: null,
  choices: null,
  adjustments: [swap, longer],
  notes: [
    { id: uid(400), text: "Pot was too full to brown", origin: "cook", at },
    { id: uid(401), text: timerAgainNote(2, "2 hrs", "Slow cook 2 hrs."), origin: "timer", at },
  ],
  messages: [{ id: uid(500), role: "cook", text: "beef isn't shredding", offers: [], at }],
  startedAt: at,
  updatedAt: at,
};

test("the evening reads as the changes, what was said, the timers and the conversation", () => {
  const text = eveningForPrompt(session);
  expect(text).toContain(`- Celery → carrot (swap, ${CELERY})`);
  expect(text).toContain("- Pot was too full to brown");
  expect(text).toContain("Ran the 2 hrs timer on step 2 again once it finished (“Slow cook 2 hrs.”): it needed longer.");
  expect(text).toContain("Cook: beef isn't shredding");
  expect(suggestPrompt(recipe, session)).toContain(`2. [${SLOW}] Slow cook 2 hrs.`);
});

test("the model's suggestions, checked, with every change taken kept", () => {
  let n = 0;
  const content = JSON.stringify({
    suggestions: [
      {
        kind: "step",
        stepId: SLOW,
        text: "Slow cook 3 hrs, until it pulls apart.",
        summary: "Slow cook 3 hrs",
        why: "You ran the timer again.",
        decision: "keep",
      },
      { kind: "tip", stepId: SEAR, tip: "Sear in two batches.", summary: "Sear in batches", why: "The pot was too full.", decision: "keep" },
      { kind: "leave-out", ingredientId: uid(999), summary: "nope", why: "", decision: "keep" },
    ],
  });
  const suggestions = parseSuggestions(content, recipe, session, 1, () => uid(800 + n++));
  expect(suggestions.map((s) => [s.adjustment.kind, s.decision])).toEqual([
    ["step", "keep"],
    ["tip", "keep"],
    ["swap", "once"],
  ]);
  // The step suggested again keeps the taken adjustment's id; the new tip gets one of its own.
  expect(suggestions[0]!.adjustment.id).toBe(longer.id);
  expect(suggestions[0]!.adjustment).toMatchObject({ text: "Slow cook 3 hrs, until it pulls apart." });
  expect(suggestions[1]!.adjustment.id).toBe(uid(800));
  expect(suggestions[1]!.why).toBe("The pot was too full.");
  expect(suggestions[2]!.adjustment).toBe(swap);
});

test("an answer that is not one is an error", () => {
  expect(() => parseSuggestions("nope", recipe, session, 1)).toThrow(SuggestError);
});

test("a long step is shortened in the timer note", () => {
  expect(timerAgainNote(3, "20 minutes", "a ".repeat(50))).toMatch(
    /^Ran the 20 minutes timer on step 3 again once it finished \(“a a .*…”\): it needed longer\.$/
  );
});
