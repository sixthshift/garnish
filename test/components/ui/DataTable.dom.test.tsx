// What a person does with a long reference table: a row's ⋯ menu runs its
// action, Show more draws the next page, search and select-all reach rows not
// yet drawn, and Delete says how many it will act on.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { DataTable } from "../../../src/components/ui/DataTable";
import type { DataTableColumn } from "../../../src/lib/ui/dataTable";

type Row = { id: string; name: string };
const rows: Row[] = Array.from({ length: 60 }, (_, i) => ({ id: `r${i}`, name: `food ${String(i).padStart(2, "0")}` }));
const columns: DataTableColumn<Row>[] = [{ key: "name", header: "Name", value: (row) => row.name }];
const drawn = () => document.querySelectorAll("tbody tr[data-row]").length;

test("a row's menu runs the chosen action on that row", async () => {
  const user = userEvent.setup();
  const edit = vi.fn();
  const merge = vi.fn();
  render(
    <DataTable
      items={rows}
      columns={columns}
      keyOf={(row) => row.id}
      itemName="food"
      rowActions={[
        { label: "Edit", onSelect: edit },
        { label: "Merge", onSelect: merge },
      ]}
    />
  );
  await user.click(screen.getByRole("button", { name: "Actions for food 03" }));
  await user.click(screen.getByRole("menuitem", { name: "Merge" }));
  expect(merge).toHaveBeenCalledWith(rows[3]);
  expect(edit).not.toHaveBeenCalled();
  expect(screen.queryByRole("menu")).toBeNull();
});

test("Show more and Show all draw the rest; search reaches a row past the first page", async () => {
  const user = userEvent.setup();
  render(<DataTable items={rows} columns={columns} keyOf={(row) => row.id} itemName="food" />);
  expect(drawn()).toBe(50);
  expect(screen.queryByText("food 55")).toBeNull();

  await user.type(screen.getByLabelText("Search foods"), "55");
  expect(drawn()).toBe(1);
  expect(screen.getByText("food 55")).toBeTruthy();
  await user.clear(screen.getByLabelText("Search foods"));
  expect(drawn()).toBe(50);

  // Sorting runs over every row, not just the drawn page.
  await user.click(screen.getByRole("button", { name: "Name" }));
  expect(within(document.querySelector("tbody") as HTMLElement).getAllByRole("row")[0]?.textContent).toContain("food 59");
  await user.click(screen.getByRole("button", { name: "Name" }));

  await user.click(screen.getByRole("button", { name: "Show 10 more" }));
  expect(drawn()).toBe(60);
  expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
});

test("select-all takes every matching row, drawn or not, and Delete says how many", async () => {
  const user = userEvent.setup();
  const onDelete = vi.fn();
  render(<DataTable items={rows} columns={columns} keyOf={(row) => row.id} itemName="food" onDelete={onDelete} />);
  await user.click(screen.getByRole("checkbox", { name: "Select all 60 foods, including 10 not shown" }));
  expect(screen.getByText(/60 selected/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Delete 60" }));
  expect(onDelete).toHaveBeenCalledWith(rows);
});
