// The cooking assistant's question (decisions.md row 214): one prompt, one
// answer, read and checked by the domain (src/domain/recipes/cooking/assistant.ts).
// Nothing is written here; askCooking (src/api/rpc/cookingAssistant.ts)
// keeps the turn in the session.

import {
  ASSISTANT_JSON_SCHEMA,
  type AssistantAnswer,
  AssistantError,
  type AssistantInput,
  assistantPrompt,
  parseAssistantAnswer,
} from "../../domain/recipes/cooking";
import { type AiClient, AiError } from "./client";
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
