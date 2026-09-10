// A table over a list of reference rows — foods, units, aisles, tags. The
// design system has no data table, so this is the local primitive the whole
// of Settings is built from: a search box, sortable column headers, a
// checkbox per row, and an Edit button that hands the row back to the parent.
//
// It owns only view state (the query, the sort, the selection). The rows,
// what a column shows, and what Edit or Delete do all come from props, so
// every tab describes its own table and nothing here knows about foods.
//
// Filtering and sorting are pure functions exported beside the component:
// they are the part worth testing, and a tab that needs the same order
// somewhere else can call them directly.
import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { cn } from "@sixthshift/design-system/utils";
import { type ReactNode, useMemo, useState } from "react";

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

export type DataTableProps<T> = {
  items: readonly T[];
  columns: readonly DataTableColumn<T>[];
  keyOf: (item: T) => string;
  /** Names the table, and the singular of a row: "food", "unit". */
  itemName: string;
  /** Plural of `itemName`; defaults to `itemName + "s"`. */
  itemNamePlural?: string;
  /** When given, each row grows an Edit button. */
  onEdit?: (item: T) => void;
  /** When given, a Delete button acts on the selected rows. */
  onDelete?: (items: T[]) => void;
  /** Rows carry checkboxes. Defaults to true when `onDelete` is given. */
  selectable?: boolean;
  /** Extra toolbar content, e.g. an Add button. */
  actions?: ReactNode;
  /** Shown instead of rows when there are none at all. */
  emptyText?: string;
  className?: string;
};

export function DataTable<T>({
  items,
  columns,
  keyOf,
  itemName,
  itemNamePlural,
  onEdit,
  onDelete,
  selectable = onDelete !== undefined,
  actions,
  emptyText,
  className,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>(() => (columns[0] ? { key: columns[0].key, dir: "asc" } : null));
  const [selected, setSelected] = useState<readonly string[]>([]);

  const plural = itemNamePlural ?? `${itemName}s`;
  const visible = useMemo(() => sortItems(filterItems(items, columns, query), columns, sort), [items, columns, query, sort]);
  const visibleKeys = visible.map(keyOf);
  const selectedItems = visible.filter((item) => selected.includes(keyOf(item)));
  const columnCount = columns.length + (selectable ? 1 : 0) + (onEdit ? 1 : 0);

  return (
    <div className={cn("flex flex-col gap-3", className)} data-table={itemName}>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          className="min-w-40 flex-1"
          value={query}
          onChange={(next) => setQuery(next)}
          placeholder={`Search ${plural}`}
          aria-label={`Search ${plural}`}
          clearLabel="Clear search"
        />
        {actions}
        {onDelete !== undefined && (
          <Button
            type="button"
            variant="outline"
            intent="danger"
            size="sm"
            disabled={selectedItems.length === 0}
            onClick={() => onDelete(selectedItems)}
          >
            Delete
          </Button>
        )}
      </div>

      <Muted as="p" className="text-sm" data-table-count>
        {visible.length === items.length
          ? `${items.length} ${items.length === 1 ? itemName : plural}`
          : `${visible.length} of ${items.length} ${plural}`}
        {selectedItems.length > 0 ? `, ${selectedItems.length} selected` : ""}
      </Muted>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{plural}</caption>
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className="w-8 p-2">
                  <Checkbox
                    aria-label={`Select all ${plural}`}
                    checked={headerChecked(selected, visibleKeys)}
                    onCheckedChange={() => setSelected(toggleAll(selected, visibleKeys))}
                  />
                </th>
              )}
              {columns.map((column) => {
                const sorted = sort?.key === column.key ? sort.dir : null;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn("p-2 font-medium", column.className)}
                    aria-sort={sorted === null ? "none" : sorted === "asc" ? "ascending" : "descending"}
                  >
                    {column.sortable === false ? (
                      column.header
                    ) : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        data-sort={sorted ?? "none"}
                        onClick={() => setSort(nextSort(sort, column.key))}
                      >
                        {column.header}
                        <SortArrow direction={sorted} />
                      </button>
                    )}
                  </th>
                );
              })}
              {onEdit !== undefined && (
                <th scope="col" className="w-16 p-2">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
              const key = keyOf(item);
              const rowName = cellText(columns[0]?.value(item) ?? key);
              return (
                <tr key={key} data-row={key} className="border-t">
                  {selectable && (
                    <td className="p-2">
                      <Checkbox
                        aria-label={`Select ${rowName}`}
                        checked={selected.includes(key)}
                        onCheckedChange={() => setSelected(toggleKey(selected, key))}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td key={column.key} className={cn("p-2", column.className)}>
                      {column.render ? column.render(item) : cellText(column.value(item))}
                    </td>
                  ))}
                  {onEdit !== undefined && (
                    <td className="p-2 text-right">
                      <Button type="button" variant="ghost" intent="neutral" size="sm" onClick={() => onEdit(item)}>
                        Edit
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={Math.max(columnCount, 1)} className="p-4">
                  <Muted as="span">{items.length === 0 ? (emptyText ?? `No ${plural} yet.`) : `No ${plural} match “${query.trim()}”.`}</Muted>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortArrow({ direction }: { direction: SortDirection | null }) {
  if (direction === null) return null;
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === "asc" ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
    </svg>
  );
}
