import type { OriginalPart, PartRestyleCheck, RestyleCheck, RestyledPart, StyleRule } from "../../../../domain/style";

/** The model's answer, as the sheet holds it. */
export type RestyleAnswer = { parts: RestyledPart[]; check: RestyleCheck };

/** A part as the payload names it: the recipe's own name, the steps to write, and one note per ingredient row. */
export type ApplyPart = { name: string; notes: string[]; steps: { title: string; text: string; summary: string }[] };

/** The ids of the statements that start ticked: the ones the guide has on. Pure. */
export function enabledRuleIds(rules: readonly StyleRule[]): string[] {
  return rules.filter((rule) => rule.enabled).map((rule) => rule.id);
}

/**
 * Which parts start accepted: every one whose facts check passed. A part that
 * lost a number or an ingredient starts unticked, so doing nothing to it keeps
 * the author's steps. Pure.
 */
export function initialTicked(check: RestyleCheck): Set<number> {
  return new Set(check.parts.flatMap((part, index) => (part.ok ? [index] : [])));
}

/**
 * What Apply sends: every part of the recipe, in the recipe's order,
 * with a ticked part taking the rewrite's steps and an unticked one keeping
 * its own. A part with no rewrite at all (which the answer's part matching makes
 * impossible, but the type allows) keeps its own too. Pure.
 */
export function applyPayload(original: readonly OriginalPart[], restyled: readonly RestyledPart[], ticked: ReadonlySet<number>): ApplyPart[] {
  return original.map((part, index) => {
    const rewrite = restyled[index];
    const keep = rewrite === undefined || !ticked.has(index);
    if (keep) {
      return {
        name: part.name,
        notes: part.ingredients.map((row) => row.note ?? ""),
        steps: part.steps.map((step) => ({ title: step.title ?? "", text: step.text, summary: step.summary ?? "" })),
      };
    }
    return { name: part.name, notes: [...rewrite.notes], steps: rewrite.steps.map((step) => ({ ...step })) };
  });
}

/** How a part is headed in the diff. The unnamed part is the recipe's method. Pure. */
export function partHeading(name: string): string {
  return name.trim() === "" ? "Method" : name.trim();
}

/**
 * The one line a failed part shows: what the rewrite dropped, named. The
 * conditions come last and in quotes because they are the author's own words
 * rather than a fact token, and they are the failure the household most needs
 * to read — a dropped "if" changes what you do, where a dropped number only
 * changes what you read. Pure.
 */
export function missingLine(check: PartRestyleCheck): string {
  const bits: string[] = [];
  if (check.missingFacts.length > 0) bits.push(`dropped ${check.missingFacts.join(", ")}`);
  if (check.missingFoods.length > 0) bits.push(`no longer mentions ${check.missingFoods.join(", ")}`);
  if (check.missingConditions.length > 0) bits.push(`no longer says ${check.missingConditions.map((phrase) => `"${phrase}"`).join(" or ")}`);
  if (check.rowMismatch) bits.push("answered a different number of ingredient notes than the part has rows");
  return bits.length === 0 ? "The rewrite changed a fact." : `The rewrite ${bits.join(" and ")}.`;
}
