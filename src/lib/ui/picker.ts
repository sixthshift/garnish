// SearchInput as a picker over a list of rows: the suggestions it shows, with a
// create row for text no row has, and what a pick or an Enter on the typed text
// resolves to. Spread onto the field: `<SearchInput value onValueChange {...picker(...)} />`.

/** A row the picker offers: its id, the name written into the field, and an optional hint shown after it. */
export type PickerOption = { value: string; label: string; hint?: string };

/** The id the create row carries; an option's id is its `value`, which is never empty. */
const CREATE_ID = "";

/** The option whose label equals `text`, ignoring case and surrounding space. Pure. */
export function exactMatch(options: readonly PickerOption[], text: string): PickerOption | undefined {
  const key = text.trim().toLowerCase();
  if (key === "") return undefined;
  return options.find((option) => option.label.trim().toLowerCase() === key);
}

/** A row as SearchInput takes it. Structurally its `SearchInputSuggestion`. */
export type PickerSuggestion = { id: string; value: string; label: string };

/**
 * The rows the field shows: the exact match first, since SearchInput's Enter
 * takes the top row, then the other options, then "Create “text”" when creation
 * is allowed and the trimmed text matches no option. Pure.
 */
export function pickerSuggestions(options: readonly PickerOption[], text: string, canCreate: boolean): PickerSuggestion[] {
  const exact = exactMatch(options, text);
  const ordered = exact ? [exact, ...options.filter((option) => option !== exact)] : options;
  const rows = ordered.map((option) => ({
    id: option.value,
    value: option.label,
    label: option.hint === undefined ? option.label : `${option.label} · ${option.hint}`,
  }));
  const trimmed = text.trim();
  if (canCreate && trimmed !== "" && exact === undefined) rows.push({ id: CREATE_ID, value: trimmed, label: `Create “${trimmed}”` });
  return rows;
}

export type PickerProps = {
  options: readonly PickerOption[];
  /** The field's text. */
  text: string;
  onSelect: (option: PickerOption) => void;
  /** When given, a "Create “text”" row shows for text that matches no option. */
  onCreate?: (text: string) => void;
};

/**
 * The three SearchInput props that make it a picker. A picked row is its option
 * or the create row; Enter on the typed text itself (ArrowUp past the first row)
 * takes the exact match, else creates.
 */
export function picker({ options, text, onSelect, onCreate }: PickerProps) {
  const take = (id: string, value: string) => {
    if (id === CREATE_ID) return onCreate?.(value.trim());
    const option = options.find((candidate) => candidate.value === id);
    if (option) onSelect(option);
  };
  return {
    suggestions: pickerSuggestions(options, text, onCreate !== undefined),
    onSuggestionSelect: (suggestion: { id?: string; value: string }) => take(suggestion.id ?? suggestion.value, suggestion.value),
    onSubmit: (value: string) => {
      const exact = exactMatch(options, value);
      if (exact) onSelect(exact);
      else if (onCreate && value.trim() !== "") onCreate(value.trim());
    },
  };
}
