// The planner lab's pure half: the flags, the week they resolve to, and the report.

import { addDays, dayLabel, weekDates, weekMonday } from "../../domain/plan";
import { type LibraryRecipe, MEALS, type Meal, type ProposalCheck, type ProposalInput } from "../../domain/planner";
import type { AiRunner } from "./client";
import { runProposal } from "./planner";

export type LabFlags = {
  /** The Monday named by `--week`, or null for the coming week. */
  week: string | null;
  /** The day tokens named by `--days` ("mon", "tue", ...), or null for all seven. */
  days: string[] | null;
  /** The meals named by `--meals`, in the order a day eats them. Dinner when the flag is absent, as the sheet's default is. */
  meals: Meal[];
  /** The models to ask, in order. */
  models: string[];
  /** A file of statements, one per line, instead of the guide's enabled rows. */
  rulesFile: string | null;
  /** Print the prompt before the answers. */
  showPrompt: boolean;
};

export const LAB_USAGE = "Usage: bun run propose [--week <monday>] [--days mon,tue] [--meals breakfast,dinner] [--model <a,b>] [--rules <file>] [--prompt]";

/** What `--meals` falls back to: dinner, the same default the proposal sheet starts from (decisions.md row 102). */
export const DEFAULT_LAB_MEALS: readonly Meal[] = ["dinner"];

/** The seven day tokens `--days` reads, Monday first, in the order `weekDates` returns a week's dates. */
export const DAY_TOKENS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** The CLI's arguments. `defaultModel` is what `--model` falls back to. Unknown flags throw so a typo does not run a blank week. Pure. */
export function parseLabFlags(argv: readonly string[], defaultModel: string): LabFlags {
  const flags: LabFlags = { week: null, days: null, meals: [...DEFAULT_LAB_MEALS], models: [defaultModel], rulesFile: null, showPrompt: false };
  const rest = [...argv];
  while (rest.length > 0) {
    const arg = rest.shift()!;
    if (arg === "--prompt") flags.showPrompt = true;
    else if (arg === "--week" || arg === "--days" || arg === "--meals" || arg === "--model" || arg === "--rules") {
      const value = rest.shift();
      if (value === undefined) throw new Error(`${arg} needs a value. ${LAB_USAGE}`);
      if (arg === "--week") flags.week = value;
      else if (arg === "--rules") flags.rulesFile = value;
      else if (arg === "--days") {
        const days = value
          .split(",")
          .map((d) => d.trim().toLowerCase())
          .filter((d) => d !== "");
        if (days.length === 0) throw new Error(`--days needs at least one day. ${LAB_USAGE}`);
        for (const day of days) {
          if (!(DAY_TOKENS as readonly string[]).includes(day)) throw new Error(`Unknown day "${day}". Days are ${DAY_TOKENS.join(", ")}. ${LAB_USAGE}`);
        }
        flags.days = days;
      } else if (arg === "--meals") {
        const meals = value
          .split(",")
          .map((m) => m.trim().toLowerCase())
          .filter((m) => m !== "");
        if (meals.length === 0) throw new Error(`--meals needs at least one meal. ${LAB_USAGE}`);
        for (const meal of meals) {
          if (!(MEALS as readonly string[]).includes(meal)) throw new Error(`Unknown meal "${meal}". Meals are ${MEALS.join(", ")}. ${LAB_USAGE}`);
        }
        // Meal order is the day's, not the flag's, so the slots read breakfast, lunch, dinner.
        flags.meals = MEALS.filter((meal) => meals.includes(meal));
      } else {
        flags.models = value
          .split(",")
          .map((m) => m.trim())
          .filter((m) => m !== "");
        if (flags.models.length === 0) throw new Error(`--model needs at least one model. ${LAB_USAGE}`);
      }
    } else throw new Error(`Unknown argument ${arg}. ${LAB_USAGE}`);
  }
  return flags;
}

/**
 * The Monday to propose for: `--week`'s own week (the app's own `?week=`
 * rule — a mid-week date lands on its Monday), or the coming week when
 * `--week` is unset, since a plan for the week already under way is mostly
 * decided. Pure; `today` is injectable so tests do not move.
 */
export function weekMondayFlag(week: string | null, today: string): string {
  return week === null ? addDays(weekMonday(undefined, today), 7) : weekMonday(week, today);
}

/** The week's dates named by `--days`, in Monday-to-Sunday order, or all seven when `--days` is unset. Pure. */
export function daysFlag(days: string[] | null, monday: string): string[] {
  const dates = weekDates(monday);
  if (days === null) return dates;
  const chosen = new Set(days);
  return DAY_TOKENS.flatMap((token, index) => (chosen.has(token) ? [dates[index]!] : []));
}

/** The statements from a `--rules` file: one per line, blanks dropped. Pure. */
export function rulesFromText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** One row of the printed table. */
export type ProposalRow = { date: string; meal: Meal; recipe: string; reason: string };

/** The check's kept entries as table rows, named from the library the proposal was built from. One row per slot, in the order the model gave them. Pure. */
export function proposalRows(check: ProposalCheck, library: readonly LibraryRecipe[]): ProposalRow[] {
  const names = new Map(library.map((recipe) => [recipe.id, recipe.name]));
  return check.entries.map((entry) => ({ date: entry.date, meal: entry.meal, recipe: names.get(entry.recipeId) ?? entry.recipeId, reason: entry.reason }));
}

/** The rows as a table: a heading, then day, meal, recipe, reason, each column widened to its longest cell. Pure. */
export function proposalTable(rows: readonly ProposalRow[]): string[] {
  if (rows.length === 0) return ["(nothing proposed)"];
  const header = ["Day", "Meal", "Recipe", "Reason"];
  const cells = rows.map((row) => [dayLabel(row.date), row.meal, row.recipe, row.reason]);
  const widths = header.map((title, col) => Math.max(title.length, ...cells.map((r) => r[col]!.length)));
  const line = (cols: readonly string[]) =>
    cols
      .map((cell, i) => cell.padEnd(widths[i]!))
      .join("  ")
      .trimEnd();
  return [line(header), ...cells.map(line)];
}

/** One model's answer as lines: the table, then one line with the dropped and unfilled counts and the time taken. Pure. */
export function reportLines(model: string, seconds: number, check: ProposalCheck, library: readonly LibraryRecipe[]): string[] {
  return [
    `## ${model}`,
    ...proposalTable(proposalRows(check, library)),
    `dropped ${check.dropped.length}, unfilled ${check.unfilled.length}, ${seconds.toFixed(1)}s`,
  ];
}

/** One model's failure as a line. Pure. */
export function failureLine(model: string, seconds: number, error: unknown): string {
  return `## ${model}  ${seconds.toFixed(1)}s  FAILED: ${error instanceof Error ? error.message : String(error)}`;
}

/** A model name to the runner that asks it. What the CLI hands in over `createFetchRunner`, and a test hands in over a fake. */
export type LabRunnerFor = (model: string) => AiRunner;

/**
 * The lab itself: `input` asked of every model in turn, each timed, checked
 * and reported, or reported as a failure when the runner throws. Nothing is
 * written; the runner is the only IO, and it is always injected. Pure aside
 * from that.
 */
export async function runLab(input: ProposalInput, models: readonly string[], runnerFor: LabRunnerFor): Promise<string[]> {
  const lines: string[] = [];
  for (const model of models) {
    const started = performance.now();
    try {
      const check = await runProposal(input, { run: runnerFor(model) });
      lines.push("", ...reportLines(model, (performance.now() - started) / 1000, check, input.library));
    } catch (error) {
      lines.push("", failureLine(model, (performance.now() - started) / 1000, error));
    }
  }
  return lines;
}
