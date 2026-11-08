// Building the restyle's answer shape in a test without restating three empty
// fields per step: a part the pass answered is `{ name, rows, notes, steps }`,
// where most steps carry no label and no supporting line and most rows carry
// no note.
import type { RestyledPart, RestyledStep } from "../../src/domain/recipes/style";

/** One step of an answer: the text, with no label and no supporting line unless given. */
export function restyledStep(text: string, extra: Partial<RestyledStep> = {}): RestyledStep {
  return { title: "", text, summary: "", ...extra };
}

/**
 * A part as a restyle answers it, from step texts alone, holding `rows` — the
 * rows' places in the recipe, or a count of rows from the first, for a recipe
 * of one part — each with an empty note: what the check needs to see the
 * answer lining up with the recipe it is about.
 */
export function restyledPart(name: string, steps: readonly string[], rows: number | readonly number[] = 0): RestyledPart {
  const places = typeof rows === "number" ? Array.from({ length: rows }, (_, i) => i) : [...rows];
  return { name, rows: places, notes: places.map(() => ""), steps: steps.map((text) => restyledStep(text)) };
}
