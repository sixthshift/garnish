// The DataTable primitive: the pure search / sort / selection helpers, and
// what the table renders on the server.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { DataTable } from "../../../src/components/ui/DataTable";
import { cellText, compareCells, type DataTableColumn, filterItems, headerChecked, nextSort, searchText, sortItems, toggleAll, toggleKey } from "../../../src/lib/ui/dataTable";

type Row = { id: string; name: string; aisle: string | null; aliases: number; skip: boolean };

const rows: Row[] = [
  { id: "1", name: "butter", aisle: "Dairy", aliases: 2, skip: false },
  { id: "2", name: "Flour", aisle: null, aliases: 0, skip: true },
  { id: "3", name: "caster sugar", aisle: "Baking", aliases: 1, skip: false },
];

const columns: DataTableColumn<Row>[] = [
  { key: "name", header: "Name", value: (row) => row.name },
  { key: "aisle", header: "Aisle", value: (row) => row.aisle },
  { key: "aliases", header: "Aliases", value: (row) => row.aliases },
  { key: "skip", header: "Skip shopping", value: (row) => row.skip },
  { key: "id", header: "Id", value: (row) => row.id, searchable: false, sortable: false },
];

const names = (items: Row[]) => items.map((row) => row.name);

describe("cellText", () => {
  test.each([
    [null, ""],
    ["butter", "butter"],
    [3, "3"],
    [true, "Yes"],
    [false, "No"],
  ])("%s -> %s", (value, expected) => {
    expect(cellText(value)).toBe(expected);
  });
});

describe("searchText", () => {
  test("joins the searchable columns, lower-cased, and skips the others", () => {
    expect(searchText(columns, rows[0]!)).toBe("butter dairy 2 no");
    expect(searchText(columns, rows[1]!)).toBe("flour  0 yes");
  });
});

describe("filterItems", () => {
  test("an empty query keeps every row, in the given order", () => {
    expect(names(filterItems(rows, columns, "   "))).toEqual(["butter", "Flour", "caster sugar"]);
  });

  test("matches a substring of any searchable column, ignoring case", () => {
    expect(names(filterItems(rows, columns, "BUT"))).toEqual(["butter"]);
    expect(names(filterItems(rows, columns, "dairy"))).toEqual(["butter"]);
  });

  test("every word must match, in any column", () => {
    expect(names(filterItems(rows, columns, "sugar baking"))).toEqual(["caster sugar"]);
    expect(names(filterItems(rows, columns, "sugar dairy"))).toEqual([]);
  });

  test("a non-searchable column is not searched", () => {
    expect(filterItems(rows, columns, "3")).toEqual([]);
  });
});

describe("compareCells", () => {
  test("numbers numerically, text case-insensitively, true before false", () => {
    expect(compareCells(2, 10)).toBeLessThan(0);
    expect(compareCells("Flour", "butter")).toBeGreaterThan(0);
    expect(compareCells(true, false)).toBeLessThan(0);
    expect(compareCells("a", "a")).toBe(0);
  });

  test("an empty or null value sorts last", () => {
    expect(compareCells(null, "a")).toBeGreaterThan(0);
    expect(compareCells("", "a")).toBeGreaterThan(0);
    expect(compareCells("a", null)).toBeLessThan(0);
    expect(compareCells(null, null)).toBe(0);
  });
});

describe("sortItems", () => {
  test("sorts by a column, both directions, case-insensitively", () => {
    expect(names(sortItems(rows, columns, { key: "name", dir: "asc" }))).toEqual(["butter", "caster sugar", "Flour"]);
    expect(names(sortItems(rows, columns, { key: "name", dir: "desc" }))).toEqual(["Flour", "caster sugar", "butter"]);
  });

  test("numbers sort numerically, not as text", () => {
    const many = [...rows, { id: "4", name: "salt", aisle: "Pantry", aliases: 10, skip: false }];
    expect(sortItems(many, columns, { key: "aliases", dir: "asc" }).map((row) => row.aliases)).toEqual([0, 1, 2, 10]);
  });

  test("a null value stays last whichever way the column is sorted", () => {
    expect(names(sortItems(rows, columns, { key: "aisle", dir: "asc" }))).toEqual(["caster sugar", "butter", "Flour"]);
    expect(names(sortItems(rows, columns, { key: "aisle", dir: "desc" }))).toEqual(["butter", "caster sugar", "Flour"]);
  });

  test("no sort, or an unknown key, keeps the given order and copies the array", () => {
    const same = sortItems(rows, columns, null);
    expect(names(same)).toEqual(names(rows));
    expect(same).not.toBe(rows);
    expect(names(sortItems(rows, columns, { key: "nope", dir: "asc" }))).toEqual(names(rows));
  });
});

describe("nextSort", () => {
  test("a new column sorts ascending; the sorted column flips", () => {
    expect(nextSort(null, "name")).toEqual({ key: "name", dir: "asc" });
    expect(nextSort({ key: "aisle", dir: "desc" }, "name")).toEqual({ key: "name", dir: "asc" });
    expect(nextSort({ key: "name", dir: "asc" }, "name")).toEqual({ key: "name", dir: "desc" });
    expect(nextSort({ key: "name", dir: "desc" }, "name")).toEqual({ key: "name", dir: "asc" });
  });
});

describe("selection", () => {
  test("toggleKey adds then removes, without touching the input", () => {
    const first = toggleKey([], "1");
    expect(first).toEqual(["1"]);
    expect(toggleKey(first, "2")).toEqual(["1", "2"]);
    expect(toggleKey(["1", "2"], "1")).toEqual(["2"]);
  });

  test("toggleAll picks every visible key, and any selection clears", () => {
    expect(toggleAll([], ["1", "2"])).toEqual(["1", "2"]);
    expect(toggleAll(["1"], ["1", "2"])).toEqual([]);
    expect(toggleAll([], [])).toEqual([]);
  });

  test("headerChecked is mixed for a partial selection", () => {
    expect(headerChecked([], ["1", "2"])).toBe(false);
    expect(headerChecked(["1"], ["1", "2"])).toBe("indeterminate");
    expect(headerChecked(["1", "2"], ["1", "2"])).toBe(true);
    expect(headerChecked(["1"], [])).toBe(false);
  });
});

describe("DataTable render", () => {
  const render = (props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) =>
    renderToString(<DataTable items={rows} columns={columns} keyOf={(row) => row.id} itemName="food" {...props} />);

  test("renders a search box, a header per column and a row per item, sorted by the first column", () => {
    const html = render();
    expect(html).toContain('aria-label="Search foods"');
    for (const column of columns) expect(html).toContain(`>${column.header}<`);
    expect(html).toContain("3 foods");
    for (const row of rows) expect(html).toContain(`data-row="${row.id}"`);
    // First column ascending by default: butter, caster sugar, Flour.
    expect(html.indexOf("butter")).toBeLessThan(html.indexOf("caster sugar"));
    expect(html.indexOf("caster sugar")).toBeLessThan(html.indexOf("Flour"));
    expect(html).toContain('aria-sort="ascending"');
  });

  test("booleans print as Yes / No and a null cell prints as nothing", () => {
    const html = render();
    expect(html).toContain(">Yes<");
    expect(html).toContain(">No<");
    expect(html).not.toContain("null");
  });

  test("a column's render function replaces the plain value", () => {
    const html = render({ columns: [{ key: "name", header: "Name", value: (row) => row.name, render: (row) => <b>{row.name}</b> }] });
    expect(html).toContain("<b>butter</b>");
  });

  test("no checkboxes, no Edit and no Delete unless asked for", () => {
    const html = render();
    expect(html).not.toContain('role="checkbox"');
    expect(html).not.toContain(">Edit<");
    expect(html).not.toContain(">Delete<");
  });

  test("onEdit adds a row button, onDelete adds checkboxes and a disabled Delete", () => {
    const html = render({ onEdit: () => {}, onDelete: () => {} });
    expect(html.match(/>Edit</g)).toHaveLength(rows.length);
    expect(html).toContain('aria-label="Select all foods"');
    expect(html).toContain('aria-label="Select butter"');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Delete<\/button>/);
  });

  test("selectable can be asked for without a delete", () => {
    const html = render({ selectable: true });
    expect(html).toContain('aria-label="Select all foods"');
    expect(html).not.toContain(">Delete<");
  });

  test("an empty list says so, in the singular where it counts", () => {
    const html = render({ items: [] });
    expect(html).toContain("No foods yet.");
    expect(html).toContain("0 foods");
    expect(renderToString(<DataTable items={[rows[0]!]} columns={columns} keyOf={(row) => row.id} itemName="food" />)).toContain("1 food<");
  });

  test("emptyText overrides the default empty line", () => {
    expect(render({ items: [], emptyText: "Nothing here." })).toContain("Nothing here.");
  });

  test("toolbar actions render beside the search box", () => {
    expect(render({ actions: <button type="button">Add food</button> })).toContain(">Add food<");
  });
});
