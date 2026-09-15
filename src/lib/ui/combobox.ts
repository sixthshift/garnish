export type ComboboxOption = { value: string; label: string; hint?: string };

/** A row in the open list: an option, or the create affordance for the typed text. */
export type ComboboxItem = { kind: "option"; option: ComboboxOption } | { kind: "create"; text: string };

/** The option whose label equals `text`, ignoring case and surrounding space. Pure. */
export function exactMatch(options: readonly ComboboxOption[], text: string): ComboboxOption | undefined {
  const key = text.trim().toLowerCase();
  if (key === "") return undefined;
  return options.find((option) => option.label.trim().toLowerCase() === key);
}

/**
 * The rows the open list shows: every option, then a create row when creation
 * is allowed and the trimmed text is non-empty and matches no option. Pure.
 */
export function listItems(options: readonly ComboboxOption[], text: string, canCreate: boolean): ComboboxItem[] {
  const items: ComboboxItem[] = options.map((option) => ({ kind: "option", option }));
  const trimmed = text.trim();
  if (canCreate && trimmed !== "" && exactMatch(options, trimmed) === undefined) items.push({ kind: "create", text: trimmed });
  return items;
}

/** What Enter should do: take a row, take the typed text as a new value, or leave the key alone. */
export type ComboboxEnter = { kind: "pick"; item: ComboboxItem } | { kind: "pass" };

/**
 * What Enter does, given the list's state. Open, it takes the highlighted row,
 * else the exact match, else the first row — plain autocomplete. Closed, it
 * takes the exact match if there is one and otherwise offers the typed text as
 * a new value, so the key is never handed to the form while there is something
 * in the field. Blank text, or text with nothing to make of it, passes. Pure.
 */
export function enterChoice(
  items: readonly ComboboxItem[],
  options: readonly ComboboxOption[],
  text: string,
  open: boolean,
  activeItem: ComboboxItem | undefined,
  canCreate: boolean
): ComboboxEnter {
  const exact = exactMatch(options, text);
  if (open) {
    const chosen = activeItem ?? (exact ? { kind: "option" as const, option: exact } : items[0]);
    return chosen ? { kind: "pick", item: chosen } : { kind: "pass" };
  }
  const trimmed = text.trim();
  if (exact) return { kind: "pick", item: { kind: "option", option: exact } };
  if (canCreate && trimmed !== "") return { kind: "pick", item: { kind: "create", text: trimmed } };
  return { kind: "pass" };
}

/** `active` moved by `delta` within `count` rows, wrapping; -1 (nothing active) steps to the first or last row. Pure. */
export function stepActive(active: number, delta: 1 | -1, count: number): number {
  if (count === 0) return -1;
  if (active < 0) return delta === 1 ? 0 : count - 1;
  return (active + delta + count) % count;
}
