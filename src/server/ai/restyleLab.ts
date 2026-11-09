// The restyle lab's pure half: the flags, the recipe rebuilt from the author's parts, and the report.

import type { SourcePart } from "../../db/models/recipe/schema";
import type { Recipe } from "../../domain/recipes/recipe";
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

/** The CLI's arguments. `selected` is what `--model` falls back to: the Restyle model selected in Settings › AI, or null when none is. Unknown flags throw so a typo does not run a blank test. Pure. */
export function parseLabFlags(argv: readonly string[], selected: string | null): LabFlags {
  const flags: LabFlags = { recipe: "", part: null, models: selected === null ? [] : [selected], rulesFile: null, showPrompt: false };
  const rest = [...argv];
  while (rest.length > 0) {
    const arg = rest.shift()!;
    if (arg === "--prompt") flags.showPrompt = true;
    else if (arg === "--part" || arg === "--model" || arg === "--rules") {
      const value = rest.shift();
      if (value === undefined) throw new Error(`${arg} needs a value. ${LAB_USAGE}`);
      if (arg === "--part") flags.part = value;
      else if (arg === "--rules") flags.rulesFile = value;
      else {
        flags.models = value
          .split(",")
          .map((m) => m.trim())
          .filter((m) => m !== "");
        if (flags.models.length === 0) throw new Error(`--model needs at least one model. ${LAB_USAGE}`);
      }
    } else if (arg.startsWith("--")) throw new Error(`Unknown argument ${arg}. ${LAB_USAGE}`);
    else if (flags.recipe === "") flags.recipe = arg;
    else throw new Error(`One recipe at a time. ${LAB_USAGE}`);
  }
  if (flags.recipe === "") throw new Error(LAB_USAGE);
  if (flags.models.length === 0) throw new Error(`No Restyle model is selected in Settings › AI. Select one there, or pass --model. ${LAB_USAGE}`);
  return flags;
}

/**
 * The recipe as the author wrote it: with the parts a restyle kept
 * (`source_parts`), it is rebuilt from them — each part's name, its rows by
 * id with the author's notes, and its steps — so a recipe that was already
 * restyled is tried from the original rather than from the last rewrite. A
 * kept row the recipe no longer has is skipped. Without them the recipe is
 * already the author's. Pure.
 */
export function authorRecipe(recipe: Recipe, kept: readonly SourcePart[] | null): Recipe {
  if (kept === null) return recipe;
  const rows = new Map(recipe.parts.flatMap((part) => part.ingredients.map((row) => [row.id, row] as const)));
  return {
    ...recipe,
    parts: kept.map((entry, p) => ({
      id: recipe.parts[p]?.id ?? `author:${p}`,
      name: entry.name,
      ingredients: entry.rows.flatMap((rowId, i) => {
        const row = rows.get(rowId);
        return row === undefined ? [] : [{ ...row, note: entry.notes[i] ?? row.note }];
      }),
      steps: entry.steps.map((step, s) => ({ id: `author:${p}:${s}`, ...step, ingredientIds: [], image: null })),
    })),
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

/** How a part is headed in the report. */
function heading(name: string): string {
  return name.trim() === "" ? "(main body)" : name;
}

/** One model's answer as lines: the timing and the check's verdict, the counts before and after, then each part's steps and the notes it wrote. Pure. */
export function reportLines(model: string, seconds: number, before: Recipe, result: RestyleResult): string[] {
  const { check, parts } = result;
  const lines = [`## ${model}  ${seconds.toFixed(1)}s  ${check.ok ? "check ok" : "check FAILED"}`];
  if (check.missingFacts.length > 0) lines.push(`   dropped: ${check.missingFacts.join(", ")}`);
  if (check.missingFoods.length > 0) lines.push(`   no longer mentions: ${check.missingFoods.join(", ")}`);
  if (check.missingConditions.length > 0) lines.push(`   lost conditions: ${check.missingConditions.map((phrase) => `"${phrase}"`).join(", ")}`);
  if (check.addedConditions.length > 0) lines.push(`   invented conditions: ${check.addedConditions.map((phrase) => `"${phrase}"`).join(", ")}`);
  if (check.rowMismatch) lines.push("   the answer does not place every ingredient line exactly once");
  if (check.addedNumbers.length > 0) lines.push(`   added numbers: ${check.addedNumbers.join(", ")}`);
  if (check.droppedWords.length > 0) lines.push(`   dropped words: ${check.droppedWords.join(" ")}`);
  for (const issue of check.issues) lines.push(`   reads wrong: ${issue.message}`);
  for (const [n, revision] of (result.revisions ?? []).entries()) {
    lines.push(
      `   sent back (${n + 1}) with ${revision.problems.length} to fix; the revision was ${revision.taken ? "better, and taken" : "no better, and dropped"}:`
    );
    for (const problem of revision.problems) lines.push(`     - ${problem}`);
  }
  const stepsBefore = before.parts.reduce((sum, part) => sum + part.steps.length, 0);
  const stepsAfter = parts.reduce((sum, part) => sum + part.steps.length, 0);
  lines.push(`   ${before.parts.length} -> ${parts.length} parts, ${stepsBefore} -> ${stepsAfter} steps${check.rebuilt ? ", laid out afresh" : ""}`);
  for (const part of parts) {
    if (part.rows.length === 0 && part.steps.length === 0) continue;
    lines.push(
      "",
      `--- ${heading(part.name)}  ${part.rows.length} ${part.rows.length === 1 ? "line" : "lines"}, ${part.steps.length} ${part.steps.length === 1 ? "step" : "steps"}`
    );
    for (const [n, step] of part.steps.entries()) lines.push(`${n + 1}. ${labelled(step)}`);
    // The notes only print where the rewrite wrote one, by the line's number in the prompt, so an unprepared list costs no lines.
    part.notes.forEach((note, n) => {
      if (note.trim() !== "") lines.push(`   #${part.rows[n]! + 1}: ${note}`);
    });
  }
  return lines;
}

/** One step as the report prints it: the label, the text, then the supporting line, each only where it has something. Pure. */
function labelled(step: { title: string; text: string; summary: string }): string {
  const label = step.title.trim() === "" ? "" : `${step.title.trim()} — `;
  const support = step.summary.trim() === "" ? "" : `  [${step.summary.trim()}]`;
  return `${label}${step.text}${support}`;
}
