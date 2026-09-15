// The logic behind components/ui/DataTable: search, sort and selection over rows.
import type { ReactNode } from "react";

/** What one column shows, sorts on and searches. */
export type DataTableColumn<T> = {
  /** Stable key; also the sort key. */
  key: string;
  header: ReactNode;
  /** The cell's plain value: what sorting compares and search matches. */
  value: (item: T) => string | number | boolean | null;
  /** Rich cell content. Defaults to the formatted `value`. */
  render?: (item: T) => ReactNode;
  /** Default true. */
  sortable?: boolean;
  /** Default true. */
  searchable?: boolean;
  className?: string;
};

export type SortState = { key: string; dir: SortDirection } | null;

export type SortDirection = "asc" | "desc";

/** A value as the table prints and searches it: booleans as Yes/No, null as an empty string. */
export function cellText(value: string | number | boolean | null): string {
  if (value === null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** Every searchable column of `item`, lower-cased and joined. Pure. */
export function searchText<T>(columns: readonly DataTableColumn<T>[], item: T): string {
  return columns
    .filter((column) => column.searchable !== false)
    .map((column) => cellText(column.value(item)))
    .join(" ")
    .toLowerCase();
}

/** The items whose searchable columns contain every whitespace-separated word of `query`. Pure. */
export function filterItems<T>(items: readonly T[], columns: readonly DataTableColumn<T>[], query: string): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items.slice();
  return items.filter((item) => {
    const haystack = searchText(columns, item);
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * Order for two cell values: numbers numerically, booleans true first, text
 * case-insensitively in en-AU, and an empty or null value last whichever way
 * the column is sorted. Pure.
 */
export function compareCells(a: string | number | boolean | null, b: string | number | boolean | null): number {
  const aEmpty = a === null || a === "";
  const bEmpty = b === null || b === "";
  if (aEmpty || bEmpty) return aEmpty && bEmpty ? 0 : aEmpty ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? -1 : 1;
  return cellText(a).localeCompare(cellText(b), "en-AU", { sensitivity: "base", numeric: true });
}

/**
 * `items` sorted by `sort`. An unknown key, or no sort, leaves the given
 * order alone. Empty values stay last in both directions. Pure; returns a new
 * array.
 */
export function sortItems<T>(items: readonly T[], columns: readonly DataTableColumn<T>[], sort: SortState): T[] {
  const next = items.slice();
  if (sort === null) return next;
  const column = columns.find((candidate) => candidate.key === sort.key);
  if (column === undefined) return next;
  const sign = sort.dir === "asc" ? 1 : -1;
  return next.sort((a, b) => {
    const aValue = column.value(a);
    const bValue = column.value(b);
    const aEmpty = aValue === null || aValue === "";
    const bEmpty = bValue === null || bValue === "";
    if (aEmpty || bEmpty) return aEmpty && bEmpty ? 0 : aEmpty ? 1 : -1;
    return sign * compareCells(aValue, bValue);
  });
}

/** Clicking a header: a new column sorts ascending, the sorted column flips. Pure. */
export function nextSort(sort: SortState, key: string): SortState {
  if (sort === null || sort.key !== key) return { key, dir: "asc" };
  return { key, dir: sort.dir === "asc" ? "desc" : "asc" };
}

/** `key` added to, or removed from, the selection. Pure; returns a new array. */
export function toggleKey(selected: readonly string[], key: string): string[] {
  return selected.includes(key) ? selected.filter((candidate) => candidate !== key) : [...selected, key];
}

/** The header checkbox: nothing selected picks every visible key, anything selected clears. Pure. */
export function toggleAll(selected: readonly string[], keys: readonly string[]): string[] {
  return selected.length === 0 ? keys.slice() : [];
}

/** Header checkbox state for a selection against the visible keys. Pure. */
export function headerChecked(selected: readonly string[], keys: readonly string[]): boolean | "indeterminate" {
  if (keys.length === 0 || selected.length === 0) return false;
  return keys.every((key) => selected.includes(key)) ? true : "indeterminate";
}
