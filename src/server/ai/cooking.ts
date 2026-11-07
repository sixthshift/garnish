// The cooking assistant's question and the review's suggestions (decisions.md
// row 214): one prompt, one answer each, read and checked by the domain
// (src/domain/recipes/cooking/). Nothing is written here; askCooking and
// suggestCooking (src/api/rpc/cookingAssistant.ts) keep what is kept.

import {
  ASSISTANT_JSON_SCHEMA,
  type AssistantAnswer,
  AssistantError,
  type AssistantInput,
  assistantPrompt,
  type CookSession,
  parseAssistantAnswer,
  parseSuggestions,
  SUGGEST_JSON_SCHEMA,
  SuggestError,
  type Suggestion,
  suggestPrompt,
} from "../../domain/recipes/cooking";
import type { Recipe } from "../../domain/recipes/recipe";
import { AI_TIMEOUT_MS, type AiClient, AiError } from "./client";
import serverAi from "./provider";

/** A chat answer is wanted at the stove: half a minute, not the import's minute. */
export const ASSISTANT_TIMEOUT_MS = 30_000;

/**
 * Ask the assistant once. `factor` is the page's servings over the recipe's
 * own, so an amount it offers is stored at the recipe's servings. Fails as
 * an `AiError`, the way the import, the restyle and the planner do.
 */
export async function runAssistant(input: AssistantInput, factor: number, options: { ai?: AiClient; model?: string } = {}): Promise<AssistantAnswer> {
  const { ai = serverAi, model = ai.model("cook") } = options;
  let content: string;
  try {
    content = await ai.ask({
      prompt: assistantPrompt(input),
      schema: ASSISTANT_JSON_SCHEMA,
      schemaName: "cooking_answer",
      model,
      timeoutMs: ASSISTANT_TIMEOUT_MS,
    });
  } catch (cause) {
    if (cause instanceof AiError) throw cause;
    throw new AiError("failed", `The model could not be reached: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  try {
    return parseAssistantAnswer(content, input.recipe, factor);
  } catch (cause) {
    if (cause instanceof AssistantError) throw new AiError("malformed", cause.message);
    throw cause;
  }
}

/**
 * The review's suggestions (decisions.md row 214): the stored recipe and the
 * whole session, asked of the cook model once. Every adjustment taken is in
 * the result whatever the model says. Fails as an `AiError`; the caller falls
 * back to the adjustments alone.
 */
export async function runSuggestions(recipe: Recipe, session: CookSession, options: { ai?: AiClient; model?: string } = {}): Promise<Suggestion[]> {
  const { ai = serverAi, model = ai.model("cook") } = options;
  const factor = session.servings !== null && recipe.recipeServings > 0 ? session.servings / recipe.recipeServings : 1;
  let content: string;
  try {
    content = await ai.ask({
      prompt: suggestPrompt(recipe, session),
      schema: SUGGEST_JSON_SCHEMA,
      schemaName: "cooking_suggestions",
      model,
      timeoutMs: AI_TIMEOUT_MS,
    });
  } catch (cause) {
    if (cause instanceof AiError) throw cause;
    throw new AiError("failed", `The model could not be reached: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  try {
    return parseSuggestions(content, recipe, session, factor);
  } catch (cause) {
    if (cause instanceof SuggestError) throw new AiError("malformed", cause.message);
    throw cause;
  }
}
