// What the two labs (`bun run restyle`, `bun run propose`) share: the live database, a rules file, and a timed run per model.

import type { Database } from "bun:sqlite";
import { databasePath, openDatabase } from "../../db/connection/open";
import { ensureDataDir } from "../core/boot";

/** The household's database, which must already exist: an empty one would answer "no such table". The app or `bun run seed` builds it. */
export async function openLabDb(usage: string): Promise<Database> {
  const path = databasePath(ensureDataDir());
  if (!(await Bun.file(path).exists())) throw new Error(`No database at ${path}. Start the app or run \`bun run seed\` first. ${usage}`);
  return openDatabase(path);
}

/** The statements from a `--rules` file: one per line, blank lines and `#` comments dropped. Pure. */
export function rulesFromText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

/**
 * Each model in turn, timed: `report` turns an answer into lines, a throw
 * becomes one FAILED line. Every model's lines are led by a blank one.
 */
export async function eachModel<T>(
  models: readonly string[],
  run: (model: string) => Promise<T>,
  report: (model: string, seconds: number, answer: T) => string[]
): Promise<string[]> {
  const lines: string[] = [];
  for (const model of models) {
    const started = performance.now();
    try {
      const answer = await run(model);
      lines.push("", ...report(model, (performance.now() - started) / 1000, answer));
    } catch (error) {
      lines.push("", failureLine(model, (performance.now() - started) / 1000, error));
    }
  }
  return lines;
}

/** One model's failure as a line. Pure. */
export function failureLine(model: string, seconds: number, error: unknown): string {
  return `## ${model}  ${seconds.toFixed(1)}s  FAILED: ${error instanceof Error ? error.message : String(error)}`;
}
