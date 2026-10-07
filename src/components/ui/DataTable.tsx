import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { cn } from "@sixthshift/design-system/utils";
import { type ReactNode, useMemo, useState } from "react";
import {
  cellText,
  type DataTableColumn,
  filterItems,
  headerChecked,
  nextSort,
  type SortDirection,
  type SortState,
  sortItems,
  toggleAll,
  toggleKey,
} from "../../lib/ui/dataTable";
import { Menu } from "./Menu";

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
  /** When given, a Delete button acts on the selected rows. */
  onDelete?: (items: T[]) => void;
  /** Rows carry checkboxes. Defaults to true when `onDelete` is given. */
  selectable?: boolean;
  /**
   * Rows drawn at once; "Show more" draws the next lot. Search, sort and
   * select-all still act on every matching row, drawn or not.
   */
  pageSize?: number;
  /** Extra toolbar content, e.g. an Add button. */
  actions?: ReactNode;
  /** Shown instead of rows when there are none at all. */
  emptyText?: string;
  className?: string;
};

/** One entry in a row's ⋯ menu. */
export type RowAction<T> = { label: string; onSelect: (item: T) => void; intent?: "neutral" | "danger" };

/** Browse density's page: enough to scan, short of the 40,000px all 763 foods drew. */
export const DATA_TABLE_PAGE_SIZE = 50;

export function DataTable<T>({
  items,
  columns,
  keyOf,
  itemName,
  itemNamePlural,
  rowActions,
  onDelete,
  selectable = onDelete !== undefined,
  pageSize = DATA_TABLE_PAGE_SIZE,
  actions,
  emptyText,
  className,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>(() => (columns[0] ? { key: columns[0].key, dir: "asc" } : null));
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [limit, setLimit] = useState(pageSize);

  const plural = itemNamePlural ?? `${itemName}s`;
  const visible = useMemo(() => sortItems(filterItems(items, columns, query), columns, sort), [items, columns, query, sort]);
  const visibleKeys = visible.map(keyOf);
  const selectedItems = visible.filter((item) => selected.includes(keyOf(item)));
  const drawn = visible.slice(0, limit);
  const hidden = visible.length - drawn.length;
  const hasActions = rowActions !== undefined && rowActions.length > 0;
  const columnCount = columns.length + (selectable ? 1 : 0) + (hasActions ? 1 : 0);

  return (
    <div className={cn("flex flex-col gap-3", className)} data-table={itemName}>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          className="min-w-40 flex-1"
          value={query}
          onValueChange={(next) => {
            setQuery(next);
            setLimit(pageSize);
          }}
          placeholder={`Search ${plural}`}
          aria-label={`Search ${plural}`}
          clearLabel="Clear search"
        />
        {actions}
        {onDelete !== undefined && (
          <Button type="button" variant="outline" intent="danger" size="sm" disabled={selectedItems.length === 0} onClick={() => onDelete(selectedItems)}>
            {/* The count is on the button because a selection can reach rows not drawn. */}
            {selectedItems.length === 0 ? "Delete" : `Delete ${selectedItems.length}`}
          </Button>
        )}
      </div>

      <Muted as="p" className="text-sm" data-table-count>
        {visible.length === items.length ? `${items.length} ${items.length === 1 ? itemName : plural}` : `${visible.length} of ${items.length} ${plural}`}
        {selectedItems.length > 0 ? `, ${selectedItems.length} selected` : ""}
      </Muted>

      {/* No overflow on the card: a row's menu hangs below the row and must not be clipped by it. The
          table fits a phone because optional columns are `secondary` and the row's actions are one ⋯. */}
      <Card size="sm" className="min-w-0 p-0">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{plural}</caption>
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className="w-8 p-2">
                  <Checkbox
                    aria-label={hidden > 0 ? `Select all ${visible.length} ${plural}, including ${hidden} not shown` : `Select all ${plural}`}
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
                    className={cn("p-2 font-medium", column.secondary && "hidden md:table-cell", column.className)}
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
              {hasActions && (
                <th scope="col" className="w-12 p-2">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {drawn.map((item) => {
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
                    <td key={column.key} className={cn("p-2", column.secondary && "hidden md:table-cell", column.className)}>
                      {column.render ? column.render(item) : cellText(column.value(item))}
                    </td>
                  ))}
                  {hasActions && (
                    <td className="p-1 text-right">
                      <Menu label={`Actions for ${rowName}`} iconOnly className="inline-block">
                        {rowActions.map((action) => (
                          <Menu.Item key={action.label} intent={action.intent} onSelect={() => action.onSelect(item)}>
                            {action.label}
                          </Menu.Item>
                        ))}
                      </Menu>
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
      </Card>

      {hidden > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-table-more>
          <Muted as="p" className="mr-auto text-sm">
            Showing {drawn.length} of {visible.length}
          </Muted>
          <Button type="button" variant="outline" intent="neutral" size="sm" onClick={() => setLimit(limit + pageSize)}>
            Show {Math.min(pageSize, hidden)} more
          </Button>
          <Button type="button" variant="ghost" intent="neutral" size="sm" onClick={() => setLimit(visible.length)}>
            Show all {visible.length}
          </Button>
        </div>
      )}
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
