import { z } from "zod";

const id = z.uuid();
const timestamp = z.iso.datetime();

/** One statement of the guide, as the API reads it. */
export const styleRuleSchema = z.object({
  id,
  position: z.number().int().nonnegative(),
  text: z.string().min(1),
  enabled: z.boolean().default(true),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type StyleRule = z.infer<typeof styleRuleSchema>;

/** A statement's text, trimmed here so a blank one fails validation rather than the repository. */
export const StyleText = z.string().trim().min(1);

/** A new statement. It goes to the foot of the guide and is on unless told otherwise. */
export const StyleRuleCreate = z.object({
  text: StyleText,
  enabled: z.boolean().optional(),
  position: z.number().int().nonnegative().optional(),
});
export type StyleRuleCreate = z.infer<typeof StyleRuleCreate>;

/** An edit in place: the text, the switch, or both. */
export const StyleRuleUpdate = z.object({
  id: z.string().min(1),
  text: StyleText.optional(),
  enabled: z.boolean().optional(),
  position: z.number().int().nonnegative().optional(),
});
export type StyleRuleUpdate = z.infer<typeof StyleRuleUpdate>;

/** The full ordered id list after a move; positions are set from the array index. */
export const StyleRuleReorder = z.object({ ids: z.array(z.string().min(1)) });
export type StyleRuleReorder = z.infer<typeof StyleRuleReorder>;

export const StyleRuleId = z.object({ id: z.string().min(1) });
export type StyleRuleId = z.infer<typeof StyleRuleId>;

/**
 * Notes the Settings tab prints under a statement that needs a caveat. The
 * table has no help column on purpose — a statement is its own sentence and
 * the model is told nothing else — so a caveat lives here, keyed by the seeded
 * text and matched case-insensitively so an untouched row keeps its note. An
 * edited or hand-written statement simply has none.
 *
 * Empty at present: the metric statement's caveat is gone, because the check
 * reads a pair as one quantity written twice (decisions.md row 114) rather than
 * as two facts, one of which went missing. Pure.
 */
const NOTES: Record<string, string> = {};

/** The note for this statement, or null. Matched on the whole sentence, case-insensitively. Pure. */
export function styleRuleNote(text: string): string | null {
  return NOTES[text.trim().toLowerCase()] ?? null;
}

/** The statements a run would use, in order: the enabled ones. Pure. */
export function enabledRules(rules: readonly StyleRule[]): StyleRule[] {
  return rules.filter((rule) => rule.enabled);
}
