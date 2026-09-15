import { Button } from "@sixthshift/design-system/button";
import type { DataTableColumn } from "../../../lib/ui/dataTable";

/** Field spec shared by the Aisles and Tags tabs' rename sheet: name only. */
export const NAME_FIELDS = [{ name: "name", label: "Name", kind: "text", required: true }] as const;

/** A Merge trigger per row, appended to a reference table's columns. Shared by Foods and Units. */
export function mergeColumn<T>(onMerge: (item: T) => void): DataTableColumn<T> {
  return {
    key: "mergeAction",
    header: <span className="sr-only">Merge</span>,
    value: () => null,
    sortable: false,
    searchable: false,
    render: (item) => (
      <Button type="button" variant="ghost" intent="neutral" size="sm" onClick={() => onMerge(item)}>
        Merge
      </Button>
    ),
  };
}
