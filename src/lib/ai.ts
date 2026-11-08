import type { z } from "zod";

/** A ```json fence off an answer that came back as prose despite the schema. Pure. */
export function stripFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/.exec(trimmed);
  return fenced === null ? trimmed : fenced[1]!.trim();
}

/**
 * A model's JSON answer read against `schema`: the fence stripped, then
 * parsed, then validated. Not an answer — empty, prose, or the wrong shape —
 * is `ok: false` with the sentence to show, naming the `format` it was asked
 * for and what was therefore not done (`nothingDone`, "nothing was changed").
 * The caller throws it as its own error. Pure.
 */
export function readJsonAnswer<S extends z.ZodType>(
  content: string,
  schema: S,
  format: string,
  nothingDone: string
): { ok: true; value: z.output<S> } | { ok: false; message: string } {
  const raw = stripFence(content);
  if (raw === "") return { ok: false, message: "The model answered with nothing." };
  let answer: unknown;
  try {
    answer = JSON.parse(raw);
  } catch {
    return { ok: false, message: `The model answered in prose rather than the ${format}, so ${nothingDone}.` };
  }
  const parsed = schema.safeParse(answer);
  if (parsed.success) return { ok: true, value: parsed.data };
  const first = parsed.error.issues[0];
  const where = first && first.path.length > 0 ? ` (${first.path.join(".")}: ${first.message})` : "";
  return { ok: false, message: `The model's answer was not in the expected shape${where}. ${nothingDone[0]!.toUpperCase()}${nothingDone.slice(1)}.` };
}
