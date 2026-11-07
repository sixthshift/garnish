import { z } from "zod";
import { stripFence } from "../../../lib/ai";
import type { Recipe } from "../recipe";
import { adjustmentKey } from "./adjust";
import { ASSISTANT_JSON_SCHEMA, type CookingContext, offerToAdjustment, recipeForPrompt } from "./assistant";
import { type Suggestion, sessionSuggestions } from "./review";
import { adjustmentSchema, type CookSession } from "./session";

// The review's suggestions from a model (decisions.md row 214): what the
// whole evening — the adjustments taken, what was said, the conversation, the
// timers run again — says the recipe should change, each with why and the
// choice it starts on. Pure; asked in src/server/ai/cooking.ts. Without a
// model, or when it fails, the review shows the adjustments alone
// (`sessionSuggestions`).

/** How the evening reads to the model: the changes taken, the notes, then the conversation. Pure. */
export function eveningForPrompt(session: Pick<CookSession, "adjustments" | "notes" | "messages">): string {
  const lines: string[] = [];
  if (session.adjustments.length > 0) {
    lines.push("Changes they made tonight:");
    for (const adjustment of session.adjustments)
      lines.push(`- ${adjustment.summary} (${adjustment.kind}, ${"ingredientId" in adjustment ? adjustment.ingredientId : adjustment.stepId})`);
  }
  const said = session.notes.filter((note) => note.origin === "cook");
  if (said.length > 0) lines.push("", "What they said to remember:", ...said.map((note) => `- ${note.text}`));
  const timers = session.notes.filter((note) => note.origin === "timer");
  if (timers.length > 0) lines.push("", "The timers:", ...timers.map((note) => `- ${note.text}`));
  if (session.messages.length > 0)
    lines.push(
      "",
      "Their conversation with the assistant while cooking:",
      ...session.messages.map((turn) => `${turn.role === "cook" ? "Cook" : "Assistant"}: ${turn.text}`)
    );
  return lines.join("\n");
}

/** The question: the recipe as stored, the evening, and what to suggest. Pure. */
export function suggestPrompt(recipe: Recipe, session: CookSession): string {
  const context: CookingContext = { servings: session.servings, tickedIngredientIds: [], doneStepIds: [], nowStepId: null, timers: [] };
  return [
    "Someone has just cooked the recipe below at home and is deciding what to change in it for next time. Suggest the changes tonight's cooking shows the recipe should have, so it is right the next time it is made.",
    "",
    recipeForPrompt(recipe, context),
    "",
    eveningForPrompt(session),
    "",
    "Suggest only what the evening gives evidence for; nothing is better than a guess. Each suggestion is one adjustment of the kinds below, worded as the recipe should read: a step's new text keeps everything else the step says, in the recipe's own voice. A change they made tonight can be suggested as it was or better worded; a tip comes from what they said.",
    '- "amount": ingredientId, quantity (at the servings cooked, in the line\'s unit).',
    '- "swap": ingredientId, food, and quantity and unit only if they change (else 0 and "").',
    '- "leave-out": ingredientId.',
    '- "step": stepId, text (the whole new step).',
    '- "tip": stepId, tip (one short sentence).',
    'For each, why: one sentence saying what tonight showed, addressed to the cook ("You added 30 minutes and the beef still needed it."). And decision: "keep" for a correction the recipe should always have, "once" for something only tonight needed (a swap for a missing ingredient, a change for a different pot).',
    'summary is a few words a cook would recognise. Use only ids from the recipe above; fields that do not apply are "" (or 0). At most six suggestions.',
  ].join("\n");
}

/** The answer's shape: the assistant's adjustment, with why and a decision. */
export const SUGGEST_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        ...ASSISTANT_JSON_SCHEMA.properties.adjustments.items,
        required: [...ASSISTANT_JSON_SCHEMA.properties.adjustments.items.required, "why", "decision"],
        properties: {
          ...ASSISTANT_JSON_SCHEMA.properties.adjustments.items.properties,
          why: { type: "string" },
          decision: { type: "string", enum: ["keep", "once"] },
        },
      },
    },
  },
} as const;

const answerSchema = z.object({ suggestions: z.array(z.unknown()).default([]) });
const extraSchema = z.object({ why: z.string().default(""), decision: z.string().default("") });

/** Why the answer could not be read at all. */
export class SuggestError extends Error {
  readonly kind = "malformed" as const;
}

/**
 * The model's suggestions, checked: each fits the recipe and is given an id,
 * one per row; and every adjustment taken tonight that the model left out is
 * added at its default, so nothing the cook did is lost from the review.
 * `factor` is the session's servings over the recipe's own. Pure, apart from
 * the ids it makes with `newId`.
 */
export function parseSuggestions(
  content: string,
  recipe: Recipe,
  session: CookSession,
  factor: number,
  newId: () => string = () => crypto.randomUUID()
): Suggestion[] {
  let json: unknown;
  try {
    json = JSON.parse(stripFence(content));
  } catch {
    throw new SuggestError("The suggestions could not be read.");
  }
  const answer = answerSchema.safeParse(json);
  if (!answer.success) throw new SuggestError("The suggestions could not be read.");

  const seen = new Set<string>();
  const suggestions: Suggestion[] = [];
  for (const raw of answer.data.suggestions.slice(0, 6)) {
    const input = offerToAdjustment(raw, recipe, factor);
    if (input === null) continue;
    const key = adjustmentKey(input);
    if (seen.has(key)) continue;
    seen.add(key);
    const extra = extraSchema.parse(raw ?? {});
    // A taken adjustment suggested again keeps its id, so the review's choice and the page agree.
    const taken = session.adjustments.find((adjustment) => adjustmentKey(adjustment) === key && adjustment.kind === input.kind);
    const adjustment = adjustmentSchema.parse({ ...input, id: taken?.id ?? newId() });
    suggestions.push({ adjustment, why: extra.why.trim(), decision: extra.decision === "once" ? "once" : "keep" });
  }
  for (const fallback of sessionSuggestions(session)) {
    if (!seen.has(adjustmentKey(fallback.adjustment))) suggestions.push(fallback);
  }
  return suggestions;
}
