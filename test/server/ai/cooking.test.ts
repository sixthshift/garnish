// The cooking assistant's question, asked of a fake model (decisions.md row 214).
import { expect, test } from "vitest";
import type { Recipe } from "../../../src/domain/recipes/recipe";
import type { AiClient, AiRequest } from "../../../src/server/ai/client";
import { AiError } from "../../../src/server/ai/client";
import { runAssistant } from "../../../src/server/ai/cooking";

const STEP = "00000000-0000-4000-8000-000000000011";
const recipe = {
  id: "r",
  name: "Ragu",
  recipeServings: 4,
  parts: [{ id: "p", name: "", ingredients: [], steps: [{ id: STEP, title: "", text: "Slow cook 2 hrs.", summary: "", ingredientIds: [], image: null }] }],
} as unknown as Recipe;
const context = { servings: null, tickedIngredientIds: [], doneStepIds: [], nowStepId: STEP, timers: [] };

function fake(answer: string | Error): AiClient & { asked: AiRequest[] } {
  const asked: AiRequest[] = [];
  return {
    asked,
    configured: () => true,
    model: (use) => `model-for-${use}`,
    status: () => ({ provider: "api", problem: null, credential: "", configured: true, baseUrl: "", isDefaultProvider: false, models: [] }),
    check: async () => ({ ok: false, baseUrl: "", message: "" }),
    ask: async (request) => {
      asked.push(request);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
}

test("asks the cook model for a cooking answer and reads it", async () => {
  const ai = fake(
    JSON.stringify({ reply: "Another 30 minutes.", note: "", adjustments: [{ kind: "step", stepId: STEP, text: "Slow cook 3 hrs.", summary: "3 hrs" }] })
  );
  const answer = await runAssistant({ recipe, context, history: [], message: "not shredding" }, 1, { ai });
  expect(ai.asked[0]).toMatchObject({ model: "model-for-cook", schemaName: "cooking_answer" });
  expect(answer.offers).toEqual([{ kind: "step", stepId: STEP, text: "Slow cook 3 hrs.", summary: "3 hrs" }]);
});

test("an unreadable answer is malformed; an unreachable model fails", async () => {
  await expect(runAssistant({ recipe, context, history: [], message: "?" }, 1, { ai: fake("{") })).rejects.toMatchObject({ kind: "malformed" });
  await expect(runAssistant({ recipe, context, history: [], message: "?" }, 1, { ai: fake(new Error("down")) })).rejects.toBeInstanceOf(AiError);
});
