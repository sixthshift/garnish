/** What Enter on row `index` of a list should do. */
export type RowEnter = "append" | "next" | "ignore";

// "ignore" still needs the caller's preventDefault: Enter in a single-line input submits the form otherwise.
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
