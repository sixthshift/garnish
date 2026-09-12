// What Enter does inside a list of editable rows (M21.4, decisions.md row 55).
//
// Typing a recipe in is typing a list of rows, and a mouse trip to "Add
// ingredient" per row is the difference between ninety seconds and four
// minutes. Tandoor appends on Tab out of the last field; this uses Enter
// instead, because Tab is the browser's own focus order and stealing it on the
// last field leaves no way to tab out of the list at all.
//
// Enter inside a single-line input submits the enclosing form by default, so
// the handler has to `preventDefault()` whichever branch it takes — which is
// why "do nothing" is a decision here and not an absence of one.
//
// The decision is pure and the focus is not, so they are separate: `rowEnter`
// says what to do, `focusNamed` does the part that needs a document.

/** What Enter on row `index` of a list should do. */
export type RowEnter = "append" | "next" | "ignore";

/**
 * Enter on the last row appends a new one; on any earlier row it moves to the
 * next. An empty list, or an index outside it, has nothing to do. Pure.
 */
export function rowEnter(index: number, count: number): RowEnter {
  if (count <= 0 || index < 0 || index >= count) return "ignore";
  return index === count - 1 ? "append" : "next";
}

/**
 * Focus the form control with this `name`, after the render that creates it.
 * A `setTimeout` rather than a microtask because the row being focused may not
 * exist until React has committed the state change that added it. No-ops
 * outside a browser, so a server render and a static test are unaffected.
 */
export function focusNamed(name: string): void {
  if (typeof document === "undefined") return;
  setTimeout(() => {
    const found = document.querySelector<HTMLElement>(`[name="${name.replaceAll('"', '\\"')}"]`);
    found?.focus();
    if (found instanceof HTMLInputElement || found instanceof HTMLTextAreaElement) found.select?.();
  }, 0);
}

/**
 * The field Enter should land on for row `index` of the list at `path`:
 * "parts.0.ingredients.2.quantity". `field` is the first editable field of a
 * row in that list. Pure.
 */
export function rowFieldName(path: string, index: number, field: string): string {
  return `${path}.${index}.${field}`;
}
