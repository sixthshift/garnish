import type { PartRestyleCheck, RestyleCheck, RestyledPart, StyleRule } from "../../../../domain/style";

/** The model's answer, as the sheet holds it. */
export type RestyleAnswer = { parts: RestyledPart[]; check: RestyleCheck };

/** A part as the payload names it: the recipe's own name, and the steps to write. */
export type ApplyPart = { name: string; steps: string[] };

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
export function applyPayload(
  original: readonly { name: string; steps: readonly { text: string }[] }[],
  restyled: readonly RestyledPart[],
  ticked: ReadonlySet<number>
): ApplyPart[] {
  return original.map((part, index) => {
    const rewrite = restyled[index];
    const keep = rewrite === undefined || !ticked.has(index);
    return { name: part.name, steps: keep ? part.steps.map((step) => step.text) : [...rewrite.steps] };
  });
}

/** How a part is headed in the diff. The unnamed part is the recipe's method. Pure. */
export function partHeading(name: string): string {
  return name.trim() === "" ? "Method" : name.trim();
}

/** The one line a failed part shows: what the rewrite dropped, named. Pure. */
export function missingLine(check: PartRestyleCheck): string {
  const bits: string[] = [];
  if (check.missingFacts.length > 0) bits.push(`dropped ${check.missingFacts.join(", ")}`);
  if (check.missingFoods.length > 0) bits.push(`no longer mentions ${check.missingFoods.join(", ")}`);
  return bits.length === 0 ? "The rewrite changed a fact." : `The rewrite ${bits.join(" and ")}.`;
}
