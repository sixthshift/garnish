// What an import read, line by line, beside Check (decisions.md row 207): the
// page's readable text, or the text pasted, each line marked with the rows of
// the draft made from it. The only links are ones the import itself keeps: an
// ingredient's `originalText` is the line it was parsed from, and a step's text
// as the read handed it over is the step's line. Nothing is matched loosely; a
// line no row came from word for word is shown as left out.

import type { RecipeDraft } from "./types";

/** One line of the source: its text, whether the page marked it a heading, and the draft rows made from it. */
export type SourceLine = { text: string; heading: boolean; rows: string[] };

/** The source's lines with each one's words, ready to match against a draft. */
export type IndexedSource = { lines: { text: string; heading: boolean }[]; byWords: Map<string, number[]> };

/** The key the recipe's name and description take in a line's rows. */
export const NAME_ROW = "name";
export const DESCRIPTION_ROW = "description";

/**
 * A line's words, for matching: the same words in the same order, whatever
 * the punctuation, case, spacing or fraction glyph between them. A page draws
 * "▢ 2 cups rice , day old" where its JSON-LD says "2 cups rice, day old";
 * both are these words. Pure.
 */
export function wordsOf(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * The source text as lines, indexed by their words. `readableText` puts a
 * page's headings on their own line after `# `; that mark is taken off and
 * kept as `heading`. Blank lines are dropped. Pure.
 */
export function indexSource(text: string): IndexedSource {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => (line.startsWith("# ") ? { text: line.slice(2).trim(), heading: true } : { text: line, heading: false }));
  const byWords = new Map<string, number[]>();
  lines.forEach((line, index) => {
    const words = wordsOf(line.text);
    if (words === "") return;
    byWords.set(words, [...(byWords.get(words) ?? []), index]);
  });
  return { lines, byWords };
}

/**
 * The source's lines with the rows made from each. `read` is the draft as the
 * import handed it to Check, `live` the draft as it is now: an ingredient is
 * found by its `originalText` (kept through edits, and set by a bulk add from
 * a pasted line), a step by its text as read or as it now stands. A line said
 * twice on the page goes to the first row that names it, then the next. Pure.
 */
export function linkSource(source: IndexedSource, read: RecipeDraft, live: RecipeDraft): SourceLine[] {
  const rows: string[][] = source.lines.map(() => []);
  const claim = (key: string, texts: readonly (string | undefined)[]) => {
    for (const text of texts) {
      const found = source.byWords.get(wordsOf(text ?? ""));
      if (found === undefined) continue;
      const index = found.find((candidate) => rows[candidate]!.length === 0) ?? found[0]!;
      rows[index]!.push(key);
      return;
    }
  };
  const readSteps = new Map(read.parts.flatMap((part) => part.steps.map((step) => [step.id ?? "", step.text ?? ""] as const)));

  claim(NAME_ROW, [read.name, live.name]);
  claim(DESCRIPTION_ROW, [read.description, live.description]);
  for (const part of live.parts) if (part.id !== undefined && (part.name ?? "") !== "") claim(part.id, [part.name]);
  for (const part of live.parts) {
    for (const row of part.ingredients) if (row.id !== undefined) claim(row.id, [row.originalText]);
  }
  for (const part of live.parts) {
    for (const step of part.steps) if (step.id !== undefined) claim(step.id, [readSteps.get(step.id), step.text]);
  }
  return source.lines.map((line, index) => ({ ...line, rows: rows[index]! }));
}
