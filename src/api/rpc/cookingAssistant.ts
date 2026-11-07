import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import cooking from "../../db/models/cooking/repo";
import recipes from "../../db/models/recipe/repo";
import { adjustmentSchema, type CookMessage, withAdjustments } from "../../domain/recipes/cooking";
import { scaledForServings, withChoices } from "../../domain/recipes/recipe";
import { runAssistant } from "../../server/ai/cooking";
import { NotFound } from "../../server/core/errors";
import { notFoundMiddleware } from "../../server/core/fn";

export const AskCookingInput = z.object({
  recipeId: z.uuid(),
  message: z.string().trim().min(1).max(1000),
  /** What the page knows that the session does not. */
  context: z.object({
    servings: z.number().positive().finite().nullable().default(null),
    tickedIngredientIds: z.array(z.string()).max(500).default([]),
    doneStepIds: z.array(z.string()).max(500).default([]),
    nowStepId: z.string().nullable().default(null),
    timers: z
      .array(z.object({ label: z.string().max(200), remaining: z.string().max(20) }))
      .max(20)
      .default([]),
  }),
});

/**
 * Ask the cooking assistant (decisions.md row 214). The recipe goes to the
 * model as the page draws it — tonight's adjustments in, at the page's
 * servings and the session's choices — with the conversation so far. The
 * question and the answer are kept in the session, the answer with the
 * adjustments it offers (each given an id, so taking one is recorded as
 * taken), and anything the cook said to remember as a note. Returns the
 * session as it now is. The model's failures are thrown as they come, an
 * `AiError` the chat shows.
 */
export const askCooking = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(AskCookingInput)
  .handler(async ({ data }) => {
    const stored = recipes.getById(data.recipeId);
    if (!stored) throw new NotFound("recipe", data.recipeId);
    const session = cooking.get(data.recipeId);
    if (session === null) throw new NotFound("cooking session", data.recipeId);

    const servings = data.context.servings ?? session.servings;
    const recipe = scaledForServings(withChoices(withAdjustments(stored, session.adjustments), session.choices ?? {}), servings ?? undefined);
    const factor = servings !== null && stored.recipeServings > 0 ? servings / stored.recipeServings : 1;
    const answer = await runAssistant({ recipe, context: { ...data.context, servings }, history: session.messages, message: data.message }, factor);

    const at = new Date().toISOString();
    const turns: CookMessage[] = [
      { id: crypto.randomUUID(), role: "cook", text: data.message, offers: [], at },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: answer.reply,
        offers: answer.offers.map((offer) => adjustmentSchema.parse({ ...offer, id: crypto.randomUUID() })),
        at,
      },
    ];
    cooking.say(data.recipeId, turns);
    if (answer.note !== "") cooking.note(data.recipeId, { id: crypto.randomUUID(), text: answer.note, origin: "cook", at });
    return cooking.get(data.recipeId)!;
  });
