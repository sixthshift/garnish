import { z } from "zod";

// A cooking session (decisions.md row 214): what happened while a recipe was
// cooked from its page. One per recipe, held on the server so a reload, a
// second device or the review on a desktop all see the same one. Nothing in it
// is written to the recipe until the review keeps it.

const id = z.uuid();
const timestamp = z.iso.datetime();
const words = z.string().trim().min(1);

// The fields of each kind of adjustment, without its id.
const amountFields = { kind: z.literal("amount"), ingredientId: id, quantity: z.number().nonnegative(), summary: words };
const swapFields = {
  kind: z.literal("swap"),
  ingredientId: id,
  food: words,
  quantity: z.number().nonnegative().nullable().default(null),
  unit: z.string().trim().nullable().default(null),
  summary: words,
};
const leaveOutFields = { kind: z.literal("leave-out"), ingredientId: id, summary: words };
const stepFields = { kind: z.literal("step"), stepId: id, text: words, summary: words };
const tipFields = { kind: z.literal("tip"), stepId: id, tip: words, summary: words };

/**
 * One change for tonight, from the small set that maps onto the recipe
 * document: the same line at another amount; another food in the line's place
 * (by name, with an amount and unit only when they change too); the line left
 * out; a step's words rewritten; a tip on a step (the house style's supporting
 * line). Amounts are at the recipe's stored servings, so a change applies
 * whatever the page is scaled to. `summary` is what the chip and the review
 * call it ("Celery → 1 more carrot").
 */
export const adjustmentSchema = z.discriminatedUnion("kind", [
  z.object({ id, ...amountFields }),
  z.object({ id, ...swapFields }),
  z.object({ id, ...leaveOutFields }),
  z.object({ id, ...stepFields }),
  z.object({ id, ...tipFields }),
]);

/** An adjustment before it is given an id: what the assistant answers and the page sends. */
export const adjustmentInputSchema = z.discriminatedUnion("kind", [
  z.object(amountFields),
  z.object(swapFields),
  z.object(leaveOutFields),
  z.object(stepFields),
  z.object(tipFields),
]);

export type Adjustment = z.infer<typeof adjustmentSchema>;
export type AdjustmentInput = z.input<typeof adjustmentInputSchema>;

/** Something said while cooking that is not a question: kept for the review. `timer` is one the page wrote, a timer run long. */
export const cookNoteSchema = z.object({ id, text: words, origin: z.enum(["cook", "timer"]).default("cook"), at: timestamp });
export type CookNote = z.infer<typeof cookNoteSchema>;

/** One turn of the conversation with the assistant, and the adjustments its answer offered. */
export const cookMessageSchema = z.object({
  id,
  role: z.enum(["cook", "assistant"]),
  text: words,
  /** Offered with an assistant's answer; taken ones are also in the session's adjustments. */
  offers: z.array(adjustmentSchema).default([]),
  at: timestamp,
});
export type CookMessage = z.infer<typeof cookMessageSchema>;

export const cookSessionSchema = z.object({
  id,
  recipeId: id,
  /** The servings and choices it began at, so a resumed page shows the recipe as it was being cooked. */
  servings: z.number().positive().nullable().default(null),
  choices: z.record(z.string(), z.string()).nullable().default(null),
  adjustments: z.array(adjustmentSchema).default([]),
  notes: z.array(cookNoteSchema).default([]),
  messages: z.array(cookMessageSchema).default([]),
  startedAt: timestamp,
  updatedAt: timestamp,
});
export type CookSession = z.infer<typeof cookSessionSchema>;

/** How long a session is resumed as it is; older, it is offered as Finish or discard. Two days. */
export const STALE_SESSION_MS = 2 * 24 * 60 * 60 * 1000;

/** Whether `session` is past resuming at `now`. Pure. */
export function isStale(session: Pick<CookSession, "updatedAt">, now: Date = new Date()): boolean {
  return now.getTime() - new Date(session.updatedAt).getTime() > STALE_SESSION_MS;
}
