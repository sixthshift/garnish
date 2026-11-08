import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { cn } from "@sixthshift/design-system/utils";
import { defaultRangeExtractor, type Range } from "@tanstack/react-virtual";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import {
  cellText,
  type DataTableColumn,
  filterItems,
  headerChecked,
  nextSort,
  type SortDirection,
  type SortState,
  secondaryClass,
  sortItems,
  toggleAll,
  toggleKey,
} from "../../lib/ui/dataTable";
import { Menu } from "./Menu";
import { useWindowTableRows } from "./useWindowTableRows";

export type DataTableProps<T> = {
  items: readonly T[];
  columns: readonly DataTableColumn<T>[];
  keyOf: (item: T) => string;
  /** Names the table, and the singular of a row: "food", "unit". */
  itemName: string;
  /** Plural of `itemName`; defaults to `itemName + "s"`. */
  itemNamePlural?: string;
  /**
   * What a row can do, gathered in one ⋯ menu at the row's end (decision 54):
   * Edit, Merge. A menu per row rather than a button per action, so a phone
   * row keeps its width for the name.
   */
  rowActions?: readonly RowAction<T>[];
  /**
   * What a tap on a row does: Edit, for a table whose rows are edited more than
   * anything else. The first column's content becomes a button named
   * "`openLabel` <row name>" for the keyboard, and a click anywhere on the row
   * outside its checkbox and ⋯ cells does the same.
   */
  onOpen?: (item: T) => void;
  /** The verb for `onOpen`'s button. Default "Edit". */
  openLabel?: string;
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

/** One entry in a row's ⋯ menu. */
export type RowAction<T> = { label: string; onSelect: (item: T) => void; intent?: "neutral" | "danger" };

export function DataTable<T>({
  items,
  columns,
  keyOf,
  itemName,
  itemNamePlural,
  rowActions,
  onOpen,
  openLabel = "Edit",
  onDelete,
  selectable = onDelete !== undefined,
  actions,
  emptyText,
  className,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>(() => (columns[0] ? { key: columns[0].key, dir: "asc" } : null));
  const [selected, setSelected] = useState<readonly string[]>([]);
  // The row that last held focus stays drawn when it scrolls away, so an open ⋯ menu, or a checkbox
  // the keyboard is on, is never unmounted under it.
  const [pinned, setPinned] = useState<string | null>(null);

  const plural = itemNamePlural ?? `${itemName}s`;
  const visible = useMemo(() => sortItems(filterItems(items, columns, query), columns, sort), [items, columns, query, sort]);
  const visibleKeys = visible.map(keyOf);
  const selectedItems = visible.filter((item) => selected.includes(keyOf(item)));
  const hasActions = rowActions !== undefined && rowActions.length > 0;
  const columnCount = columns.length + (selectable ? 1 : 0) + (hasActions ? 1 : 0);

  const pinnedIndex = pinned === null ? -1 : visibleKeys.indexOf(pinned);
  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range);
      return pinnedIndex < 0 || indexes.includes(pinnedIndex) ? indexes : [...indexes, pinnedIndex].sort((a, b) => a - b);
    },
    [pinnedIndex]
  );
  const {
    body,
    rows: rowsDrawn,
    measureElement,
    gapAbove,
    gapEnd,
    spacer,
  } = useWindowTableRows({
    count: visible.length,
    keyAt: (index) => visibleKeys[index] ?? index,
    columnCount,
    rangeExtractor,
  });

  return (
    <div className={cn("flex flex-col gap-3", className)} data-table={itemName}>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          className="min-w-40 flex-1"
          value={query}
          onValueChange={setQuery}
          placeholder={`Search ${plural}`}
          aria-label={`Search ${plural}`}
          clearLabel="Clear search"
        />
        {actions}
        {onDelete !== undefined && (
          <Button type="button" variant="outline" intent="neutral" size="sm" disabled={selectedItems.length === 0} onClick={() => onDelete(selectedItems)}>
            {/* The count is on the button because a selection can reach rows not drawn. Neutral: it opens the
                caller's confirm, which carries the red (design-language rule 5). */}
            {selectedItems.length === 0 ? "Delete" : `Delete ${selectedItems.length}`}
          </Button>
        )}
      </div>

      <Muted as="p" className="text-sm" data-table-count>
        {visible.length === items.length ? `${items.length} ${items.length === 1 ? itemName : plural}` : `${visible.length} of ${items.length} ${plural}`}
        {selectedItems.length > 0 ? `, ${selectedItems.length} selected` : ""}
      </Muted>

      {/* No overflow on the card: a row's menu hangs below the row and must not be clipped by it. The
          table fits because optional columns are `secondary` (shown on a desktop, or a wide one), the row's actions are one ⋯,
          and the name column (`wrap: "anywhere"`) breaks a long unbroken name rather than widening the page. */}
      <Card size="sm" className="min-w-0 p-0">
        {/* The edge cells of every row stand off the card's border, whichever columns a table has. */}
        <table className="w-full border-collapse text-left text-sm [&_tr>*:first-child]:pl-4 [&_tr>*:last-child]:pr-3" aria-rowcount={visible.length + 1}>
          <caption className="sr-only">{plural}</caption>
          <thead>
            <tr aria-rowindex={1}>
              {selectable && (
                <th scope="col" className="w-8 p-2">
                  <Checkbox
                    aria-label={`Select all ${visible.length} ${plural}`}
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
                    className={cn("p-2 font-medium", secondaryClass(column.secondary), column.className)}
                    aria-sort={sorted === null ? "none" : sorted === "asc" ? "ascending" : "descending"}
                  >
                    {column.sortable === false ? (
                      column.header
                    ) : (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1"
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
              {hasActions && (
                <th scope="col" className="w-12 p-2">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody ref={body}>
            {rowsDrawn.flatMap((row, at) => {
              const item = visible[row.index] as T;
              const key = keyOf(item);
              const rowName = cellText(columns[0]?.value(item) ?? key);
              return [
                spacer(gapAbove(at), `gap-${key}`),
                <tr
                  key={key}
                  ref={measureElement}
                  data-index={row.index}
                  data-row={key}
                  aria-rowindex={row.index + 2}
                  className={cn("border-t", onOpen && "cursor-pointer hover:bg-bg-subtle")}
                  onFocus={() => setPinned(key)}
                  // The name's button carries the keyboard; its click bubbles here like any other. The checkbox
                  // and ⋯ cells (the menu's panel and its tap-outside scrim among them) keep their clicks.
                  onClick={onOpen && ((event) => (event.target as Element).closest("[data-no-open]") === null && onOpen(item))}
                >
                  {selectable && (
                    <td className="cursor-default p-2" data-no-open>
                      <Checkbox
                        aria-label={`Select ${rowName}`}
                        checked={selected.includes(key)}
                        onCheckedChange={() => setSelected(toggleKey(selected, key))}
                      />
                    </td>
                  )}
                  {columns.map((column, index) => {
                    const content = column.render ? column.render(item) : cellText(column.value(item));
                    return (
                      <td
                        key={column.key}
                        className={cn("p-2", column.wrap === "anywhere" && "wrap-anywhere", secondaryClass(column.secondary), column.className)}
                      >
                        {onOpen && index === 0 ? (
                          <button type="button" aria-label={`${openLabel} ${rowName}`} className="block w-full cursor-pointer text-left">
                            {content}
                          </button>
                        ) : (
                          content
                        )}
                      </td>
                    );
                  })}
                  {hasActions && (
                    <td className="cursor-default p-1 text-right" data-no-open>
                      <Menu label={`Actions for ${rowName}`} iconOnly className="inline-block">
                        {rowActions.map((action) => (
                          <Menu.Item key={action.label} intent={action.intent} onSelect={() => action.onSelect(item)}>
                            {action.label}
                          </Menu.Item>
                        ))}
                      </Menu>
                    </td>
                  )}
                </tr>,
              ];
            })}
            {spacer(gapEnd, "gap-end")}
            {visible.length === 0 && (
              <tr>
                <td colSpan={Math.max(columnCount, 1)} className="p-4">
                  <Muted as="span">{items.length === 0 ? (emptyText ?? `No ${plural} yet.`) : `No ${plural} match “${query.trim()}”.`}</Muted>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function SortArrow({ direction }: { direction: SortDirection | null }) {
  if (direction === null) return null;
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === "asc" ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
    </svg>
  );
}
