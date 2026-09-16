// The restyle lab's pure half: the flags, the recipe rebuilt from the author's steps, and the report.

import type { Recipe } from "../../domain/recipe";
import type { RestyleResult } from "./restyle";

export type LabFlags = {
  /** A slug, an id, or an exact name. */
  recipe: string;
  /** One part's name to try alone, or null for the whole recipe. */
  part: string | null;
  /** The models to ask, in order. */
  models: string[];
  /** A file of statements, one per line, instead of the guide's enabled rows. */
  rulesFile: string | null;
  /** Print the prompt before the answers. */
  showPrompt: boolean;
};

export const LAB_USAGE = "Usage: bun run restyle <recipe> [--part <name>] [--model <a,b>] [--rules <file>] [--prompt]";

/** The CLI's arguments. `defaultModel` is what `--model` falls back to. Unknown flags throw so a typo does not run a blank test. Pure. */
export function parseLabFlags(argv: readonly string[], defaultModel: string): LabFlags {
  const flags: LabFlags = { recipe: "", part: null, models: [defaultModel], rulesFile: null, showPrompt: false };
  const rest = [...argv];
  while (rest.length > 0) {
    const arg = rest.shift()!;
    if (arg === "--prompt") flags.showPrompt = true;
    else if (arg === "--part" || arg === "--model" || arg === "--rules") {
      const value = rest.shift();
      if (value === undefined) throw new Error(`${arg} needs a value. ${LAB_USAGE}`);
      if (arg === "--part") flags.part = value;
      else if (arg === "--rules") flags.rulesFile = value;
      else
        flags.models = value
          .split(",")
          .map((m) => m.trim())
          .filter((m) => m !== "");
    } else if (arg.startsWith("--")) throw new Error(`Unknown argument ${arg}. ${LAB_USAGE}`);
    else if (flags.recipe === "") flags.recipe = arg;
    else throw new Error(`One recipe at a time. ${LAB_USAGE}`);
  }
  if (flags.recipe === "") throw new Error(LAB_USAGE);
  return flags;
}

/**
 * The recipe as the author wrote it: every part with kept `source_steps` gets
 * them back as its steps, so a recipe that was already restyled is tried from
 * the original rather than from the last rewrite. A step keeps the id and
 * links of the current step at its index; one beyond the current count gets
 * an id of its own, so ids stay unique. Pure.
 */
export function authorRecipe(recipe: Recipe, authorSteps: ReadonlyMap<string, readonly string[]>): Recipe {
  return {
    ...recipe,
    parts: recipe.parts.map((part) => {
      const texts = authorSteps.get(part.id);
      if (texts === undefined) return part;
      return {
        ...part,
        steps: texts.map((text, index) => ({ ...(part.steps[index] ?? { id: `${part.id}:author:${index}`, ingredientIds: [], image: null }), text })),
      };
    }),
  };
}

/** The recipe cut to one part by name (case-insensitively), or unchanged when `name` is null. Throws when no part has the name. Pure. */
export function onlyPart(recipe: Recipe, name: string | null): Recipe {
  if (name === null) return recipe;
  const fold = (text: string) => text.trim().toLowerCase();
  const parts = recipe.parts.filter((part) => fold(part.name) === fold(name));
  if (parts.length === 0) throw new Error(`No part named "${name}". Parts: ${recipe.parts.map((part) => `"${part.name}"`).join(", ")}`);
  return { ...recipe, parts };
}

/** The statements from a `--rules` file: one per line, blanks and `#` comments dropped. Pure. */
export function rulesFromText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

/** How a part is headed in the report. */
function heading(name: string): string {
  return name.trim() === "" ? "(main body)" : name;
}

/** One model's answer as lines: the timing and the check's verdict, then each part's steps with the step count before and after. Pure. */
export function reportLines(model: string, seconds: number, before: Recipe, result: RestyleResult): string[] {
  const { check, parts } = result;
  const lines = [`## ${model}  ${seconds.toFixed(1)}s  ${check.ok ? "check ok" : "check FAILED"}`];
  if (check.missingFacts.length > 0) lines.push(`   dropped: ${check.missingFacts.join(", ")}`);
  if (check.missingFoods.length > 0) lines.push(`   no longer mentions: ${check.missingFoods.join(", ")}`);
  if (check.addedNumbers.length > 0) lines.push(`   added numbers: ${check.addedNumbers.join(", ")}`);
  parts.forEach((part, index) => {
    const original = before.parts[index];
    if (original === undefined || original.steps.length === 0) return;
    lines.push("", `--- ${heading(part.name)}  ${original.steps.length} -> ${part.steps.length} steps`);
    for (const [n, step] of part.steps.entries()) lines.push(`${n + 1}. ${step}`);
  });
  return lines;
}

/** One model's failure as a line. Pure. */
export function failureLine(model: string, seconds: number, error: unknown): string {
  return `## ${model}  ${seconds.toFixed(1)}s  FAILED: ${error instanceof Error ? error.message : String(error)}`;
}
