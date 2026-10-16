// What a person does with a long reference table: a row's ⋯ menu runs its
// action, search, sort and select-all reach rows the virtual list has not
// drawn, and Delete says how many it will act on.
import { render, screen } from "@testing-library/react";
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

test("search and sort reach rows the list has not drawn", async () => {
  const user = userEvent.setup();
  render(<DataTable items={rows} columns={columns} keyOf={(row) => row.id} itemName="food" />);
  const firstDraw = drawn();
  expect(firstDraw).toBeLessThan(60);
  expect(screen.queryByText("food 55")).toBeNull();

  await user.type(screen.getByLabelText("Search foods"), "55");
  expect(drawn()).toBe(1);
  expect(screen.getByText("food 55")).toBeTruthy();
  await user.clear(screen.getByLabelText("Search foods"));
  expect(drawn()).toBe(firstDraw);

  // Sorting runs over every row, not just the drawn ones.
  await user.click(screen.getByRole("button", { name: "Name" }));
  expect(document.querySelector("tbody tr[data-row]")?.textContent).toContain("food 59");
});

test("select-all takes every matching row, drawn or not, and Delete says how many", async () => {
  const user = userEvent.setup();
  const onDelete = vi.fn();
  render(<DataTable items={rows} columns={columns} keyOf={(row) => row.id} itemName="food" onDelete={onDelete} />);
  await user.click(screen.getByRole("checkbox", { name: "Select all 60 foods" }));
  expect(screen.getByText(/60 selected/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Delete 60" }));
  expect(onDelete).toHaveBeenCalledWith(rows);
});

test("a tap anywhere on a row opens it, and the keyboard reaches the same through the name", async () => {
  const user = userEvent.setup();
  const open = vi.fn();
  const merge = vi.fn();
  render(
    <DataTable
      items={rows}
      columns={[...columns, { key: "id", header: "Id", value: (row) => row.id }]}
      keyOf={(row) => row.id}
      itemName="food"
      onOpen={open}
      onDelete={() => {}}
      rowActions={[{ label: "Merge", onSelect: merge }]}
    />
  );
  await user.click(screen.getByText("r2"));
  expect(open).toHaveBeenLastCalledWith(rows[2]);

  screen.getByRole("button", { name: "Edit food 04" }).focus();
  await user.keyboard("{Enter}");
  expect(open).toHaveBeenLastCalledWith(rows[4]);
  expect(open).toHaveBeenCalledTimes(2);

  // The checkbox and the ⋯ menu keep their own clicks, closing the menu by tapping outside among them.
  await user.click(screen.getByRole("checkbox", { name: "Select food 01" }));
  await user.click(screen.getByRole("button", { name: "Actions for food 01" }));
  await user.click(screen.getByTestId("menu-scrim"));
  await user.click(screen.getByRole("button", { name: "Actions for food 01" }));
  await user.click(screen.getByRole("menuitem", { name: "Merge" }));
  expect(merge).toHaveBeenCalledWith(rows[1]);
  expect(open).toHaveBeenCalledTimes(2);
});
