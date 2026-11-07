import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import cooking from "../../db/models/cooking/repo";
import recipes from "../../db/models/recipe/repo";
import { adjustmentSchema, type CookMessage, type Suggestion, sessionSuggestions, withAdjustments } from "../../domain/recipes/cooking";
import { scaledForServings, withChoices } from "../../domain/recipes/recipe";
import { runAssistant, runSuggestions } from "../../server/ai/cooking";
import ai from "../../server/ai/provider";
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

export const SuggestCookingInput = z.object({ recipeId: z.uuid() });

/**
 * The review's suggested changes from the model (decisions.md row 214), from
 * the whole evening. `fromModel` says whether the model wrote them: with no
 * model, or when it fails, they are the adjustments taken, at their defaults,
 * and `problem` says why when it failed.
 */
export const suggestCooking = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(SuggestCookingInput)
  .handler(async ({ data }): Promise<{ suggestions: Suggestion[]; fromModel: boolean; problem: string | null }> => {
    const stored = recipes.getById(data.recipeId);
    if (!stored) throw new NotFound("recipe", data.recipeId);
    const session = cooking.get(data.recipeId);
    if (session === null) throw new NotFound("cooking session", data.recipeId);
    const fallback = sessionSuggestions(session);
    // An evening with nothing in it has nothing to read.
    const empty = session.adjustments.length === 0 && session.notes.length === 0 && session.messages.length === 0;
    if (!ai.configured() || empty) return { suggestions: fallback, fromModel: false, problem: null };
    try {
      return { suggestions: await runSuggestions(stored, session), fromModel: true, problem: null };
    } catch (cause) {
      return { suggestions: fallback, fromModel: false, problem: cause instanceof Error ? cause.message : String(cause) };
    }
  });
