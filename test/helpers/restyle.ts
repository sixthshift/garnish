// Building the restyle's answer shape in a test without restating three empty
// fields per step: a part the pass answered is `{ name, notes, steps }`, where
// most steps carry no label and no supporting line and most rows carry no note.
import type { RestyledPart, RestyledStep } from "../../src/domain/style";

/** One step of an answer: the text, with no label and no supporting line unless given. */
export function restyledStep(text: string, extra: Partial<RestyledStep> = {}): RestyledStep {
  return { title: "", text, summary: "", ...extra };
}

/**
 * A part as a restyle answers it, from step texts alone, with an empty note for
 * each of `rows` ingredient rows — which is what the check needs to see the
 * answer lining up with the part it is about.
 */
export function restyledPart(name: string, steps: readonly string[], rows = 0): RestyledPart {
  return { name, notes: Array.from({ length: rows }, () => ""), steps: steps.map((text) => restyledStep(text)) };
}
