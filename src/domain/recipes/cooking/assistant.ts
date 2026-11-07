import { z } from "zod";
import { stripFence } from "../../../lib/ai";
import { formatIngredient } from "../ingredient";
import type { Recipe } from "../recipe";
import { fitsRecipe } from "./adjust";
import { type AdjustmentInput, adjustmentInputSchema, type CookMessage } from "./session";

// The cooking assistant (decisions.md row 214): a chat about the recipe being
// cooked, whose answers can offer adjustments for tonight. Pure: the prompt,
// the answer's schema, and the check that keeps only adjustments to rows the
// recipe has. The model is asked in src/server/ai/cooking.ts.

/** What the page knows that the stored session does not: the ticks, the step being cooked and the timers. */
export type CookingContext = {
  /** The servings the page shows; the assistant's amounts are at these. */
  servings: number | null;
  tickedIngredientIds: string[];
  doneStepIds: string[];
  nowStepId: string | null;
  timers: { label: string; remaining: string }[];
};

export type AssistantInput = {
  /** The recipe as the page draws it: tonight's adjustments in, at the page's servings and choices. */
  recipe: Recipe;
  context: CookingContext;
  /** The conversation so far, oldest first. */
  history: readonly Pick<CookMessage, "role" | "text">[];
  message: string;
};

/** How many earlier turns go into a prompt: enough for "and the other one?", not a whole evening. */
export const HISTORY_TURNS = 12;

/** The recipe as the prompt shows it: each line and step with its id, ticked and done marked, the step being cooked flagged. Pure. */
export function recipeForPrompt(recipe: Recipe, context: CookingContext): string {
  const ticked = new Set(context.tickedIngredientIds);
  const done = new Set(context.doneStepIds);
  const lines: string[] = [`Recipe: ${recipe.name}${context.servings === null ? "" : ` (cooking for ${context.servings})`}`];
  for (const part of recipe.parts) {
    if (part.name.trim() !== "") lines.push("", `## ${part.name.trim()}`);
    if (part.ingredients.length > 0) {
      lines.push("Ingredients:");
      for (const row of part.ingredients)
        lines.push(
          `- [${row.id}] ${formatIngredient(row) || row.originalText}${row.fixed ? " (fixed, does not scale)" : ""}${ticked.has(row.id) ? " (got out)" : ""}`
        );
    }
    if (part.steps.length > 0) {
      lines.push("Steps:");
      part.steps.forEach((step, index) => {
        const mark = step.id === context.nowStepId ? " ← cooking now" : done.has(step.id) ? " (done)" : "";
        const tip = step.summary.trim() === "" ? "" : ` [tip: ${step.summary.trim()}]`;
        lines.push(`${index + 1}. [${step.id}] ${step.text.trim()}${tip}${mark}`);
      });
    }
  }
  if (context.timers.length > 0) lines.push("", `Timers running: ${context.timers.map((timer) => `${timer.label} (${timer.remaining} left)`).join("; ")}`);
  return lines.join("\n");
}

/** The question for the model: who it is, the recipe as it stands, the conversation, and what it may offer. Pure. */
export function assistantPrompt(input: AssistantInput): string {
  const history = input.history.slice(-HISTORY_TURNS).map((turn) => `${turn.role === "cook" ? "Cook" : "You"}: ${turn.text}`);
  return [
    "You are helping someone at home cook the recipe below, right now, at the stove. They are standing up, hands busy, reading your answer on a phone or laptop.",
    "Answer in one to three short sentences, in Australian English, with metric amounts and Celsius. Be practical and specific to this recipe; no preamble, no lists unless asked.",
    "",
    recipeForPrompt(input.recipe, input.context),
    "",
    history.length === 0 ? "" : `The conversation so far:\n${history.join("\n")}\n`,
    `Cook: ${input.message}`,
    "",
    "When your answer changes what they should do tonight, also offer it as an adjustment they can tap to apply. Offer only what you recommended, at most three, and none for a plain question. The kinds:",
    '- "amount": the same line at another amount. ingredientId, quantity (the new amount, at the servings being cooked, in the line\'s own unit).',
    '- "swap": another food in the line\'s place. ingredientId, food (its name, singular, lower case), and quantity and unit only if they change too (else 0 and "").',
    '- "leave-out": the line left out. ingredientId.',
    '- "step": the step\'s words rewritten, keeping everything else it says. stepId, text (the whole new step).',
    '- "tip": a short line to remember on a step ("Sear in two batches."). stepId, tip.',
    'Every adjustment has a summary of a few words a cook would recognise ("Celery → 1 more carrot", "Simmer 30 min longer"). Use only ids from the recipe above. Fields that do not apply are "" (or 0 for quantity).',
    "",
    'If they tell you how something went rather than asking ("too salty", "it took ages to thicken"), answer briefly and put what to remember for next time in note, in their words; otherwise note is "".',
  ]
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n");
}

/** The answer's shape as structured output: every field present, "" or 0 for one that does not apply, so any provider can keep to it. */
export const ASSISTANT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "note", "adjustments"],
  properties: {
    reply: { type: "string" },
    note: { type: "string" },
    adjustments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "ingredientId", "stepId", "quantity", "food", "unit", "text", "tip", "summary"],
        properties: {
          kind: { type: "string", enum: ["amount", "swap", "leave-out", "step", "tip"] },
          ingredientId: { type: "string" },
          stepId: { type: "string" },
          quantity: { type: "number" },
          food: { type: "string" },
          unit: { type: "string" },
          text: { type: "string" },
          tip: { type: "string" },
          summary: { type: "string" },
        },
      },
    },
  },
} as const;

const answerOfferSchema = z.object({
  kind: z.string().default(""),
  ingredientId: z.string().default(""),
  stepId: z.string().default(""),
  quantity: z.number().default(0),
  food: z.string().default(""),
  unit: z.string().default(""),
  text: z.string().default(""),
  tip: z.string().default(""),
  summary: z.string().default(""),
});
const answerSchema = z.object({ reply: z.string().default(""), note: z.string().default(""), adjustments: z.array(z.unknown()).default([]) });

/** The answer, checked: the reply, a note to keep or "", and the offers that name rows the recipe has. */
export type AssistantAnswer = { reply: string; note: string; offers: AdjustmentInput[] };

/** Why an answer could not be read at all. */
export class AssistantError extends Error {
  readonly kind = "malformed" as const;
}

/**
 * One offer as an adjustment, or null for one that is not: an unknown kind,
 * an id the recipe does not have, an amount that is not one. The model's
 * amounts are at the page's servings; a line that scales is stored at the
 * recipe's own, so it is divided back by `factor` (page over stored). Pure.
 */
export function offerToAdjustment(raw: unknown, recipe: Recipe, factor: number): AdjustmentInput | null {
  const read = answerOfferSchema.safeParse(raw);
  if (!read.success) return null;
  const offer = read.data;
  const summary = offer.summary.trim();
  const fixed = new Set(recipe.parts.flatMap((part) => part.ingredients.filter((row) => row.fixed).map((row) => row.id)));
  const stored = (quantity: number) => (fixed.has(offer.ingredientId) || !(factor > 0) ? quantity : quantity / factor);
  const candidate: unknown =
    offer.kind === "amount"
      ? { kind: "amount", ingredientId: offer.ingredientId, quantity: offer.quantity > 0 ? stored(offer.quantity) : -1, summary }
      : offer.kind === "swap"
        ? {
            kind: "swap",
            ingredientId: offer.ingredientId,
            food: offer.food,
            quantity: offer.quantity > 0 ? stored(offer.quantity) : null,
            unit: offer.unit.trim() === "" ? null : offer.unit.trim(),
            summary,
          }
        : offer.kind === "leave-out"
          ? { kind: "leave-out", ingredientId: offer.ingredientId, summary }
          : offer.kind === "step"
            ? { kind: "step", stepId: offer.stepId, text: offer.text, summary }
            : offer.kind === "tip"
              ? { kind: "tip", stepId: offer.stepId, tip: offer.tip, summary }
              : null;
  const parsed = adjustmentInputSchema.safeParse(candidate);
  if (!parsed.success || !fitsRecipe(recipe, parsed.data)) return null;
  return parsed.data;
}

/** Read the model's answer. Throws `AssistantError` for one that is not an answer at all; drops any offer that does not fit. Pure. */
export function parseAssistantAnswer(content: string, recipe: Recipe, factor: number): AssistantAnswer {
  const raw = stripFence(content);
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    // A model that ignored the format but answered in words has still answered.
    if (raw !== "" && !raw.startsWith("{")) return { reply: raw, note: "", offers: [] };
    throw new AssistantError("The assistant's answer could not be read.");
  }
  const answer = answerSchema.safeParse(json);
  if (!answer.success || answer.data.reply.trim() === "") throw new AssistantError("The assistant's answer could not be read.");
  return {
    reply: answer.data.reply.trim(),
    note: answer.data.note.trim(),
    offers: answer.data.adjustments.flatMap((offer) => offerToAdjustment(offer, recipe, factor) ?? []).slice(0, 3),
  };
}
