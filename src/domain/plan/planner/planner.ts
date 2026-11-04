import { z } from "zod";

const id = z.uuid();
const timestamp = z.iso.datetime();

/** One statement of the planner guide, as the API reads it. The house style guide's shape exactly. */
export const plannerRuleSchema = z.object({
  id,
  position: z.number().int().nonnegative(),
  text: z.string().min(1),
  enabled: z.boolean().default(true),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type PlannerRule = z.infer<typeof plannerRuleSchema>;

/** A statement's text, trimmed here so a blank one fails validation rather than the repository. */
export const PlannerText = z.string().trim().min(1);

/** A new statement. It goes to the foot of the guide and is on unless told otherwise. */
export const PlannerRuleCreate = z.object({
  text: PlannerText,
  enabled: z.boolean().optional(),
  position: z.number().int().nonnegative().optional(),
});
export type PlannerRuleCreate = z.infer<typeof PlannerRuleCreate>;

/** An edit in place: the text, the switch, or both. */
export const PlannerRuleUpdate = z.object({
  id: z.string().min(1),
  text: PlannerText.optional(),
  enabled: z.boolean().optional(),
  position: z.number().int().nonnegative().optional(),
});
export type PlannerRuleUpdate = z.infer<typeof PlannerRuleUpdate>;

/** The full ordered id list after a move; positions are set from the array index. */
export const PlannerRuleReorder = z.object({ ids: z.array(z.string().min(1)) });
export type PlannerRuleReorder = z.infer<typeof PlannerRuleReorder>;

export const PlannerRuleId = z.object({ id: z.string().min(1) });
export type PlannerRuleId = z.infer<typeof PlannerRuleId>;

/** The statements a proposal would read out, in order: the enabled ones. Pure. */
export function enabledRules(rules: readonly PlannerRule[]): PlannerRule[] {
  return rules.filter((rule) => rule.enabled);
}
