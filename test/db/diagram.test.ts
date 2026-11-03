// The schema page (`bun run db:diagram`): read from the real migrations, so a
// table, key or trigger added by a migration shows up without anyone telling it.
import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../src/db/connection/open";
import { DEFAULT_OUT, parseDiagramArgs } from "../../src/db/diagram/cli";
import { erDiagram, readSchema, schemaHtml } from "../../src/db/diagram/diagram";
import { migrate } from "../../src/db/migrations/migrate";

let db: Database;
beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
});

test("reads every table with its keys, checks and triggers", () => {
  const tables = readSchema(db);
  expect(tables.map((t) => t.name)).toContain("alternative");

  const alternative = tables.find((t) => t.name === "alternative")!;
  expect(alternative.foreignKeys).toContainEqual({ from: "ingredient_id", table: "ingredient", to: "id", onDelete: "CASCADE" });
  expect(alternative.checks.some((c) => c.includes("plan_picks IN (0, 1)"))).toBe(true);

  const item = tables.find((t) => t.name === "alternative_item")!;
  expect(item.triggers.map((t) => t.name)).toEqual(["alternative_item_last"]);
  expect(item.indexes.some((i) => i.unique && i.columns.join() === "alternative_id,position")).toBe(true);
});

test("the diagram draws a line per key between shown tables, and the JSON references dashed", () => {
  const tables = readSchema(db);
  const focus = erDiagram(tables, new Set(["food", "alternative_item", "meal_plan_entry", "ingredient"]));
  expect(focus).toContain('food ||--o{ alternative_item : "food_id (cascade)"');
  // A key to a table left out is not drawn.
  expect(focus).not.toContain("alternative ||--o{");
  expect(focus).toContain('ingredient |o..o{ meal_plan_entry : "choices JSON key (no FK)"');
});

test("the page escapes what it prints and has a focus diagram only when asked", () => {
  const tables = readSchema(db);
  const plain = schemaHtml(tables);
  expect(plain).toContain(`${tables.length} tables`);
  expect(plain).not.toContain('id="focus"');
  expect(plain).not.toMatch(/<pre class="mermaid">[^<]*<[^/]/);
  expect(schemaHtml(tables, { focus: ["food", "nope"] })).toContain("Focus: food<");
});

test("arguments: defaults, --focus and --out, and nothing unknown", () => {
  expect(parseDiagramArgs([])).toEqual({ out: DEFAULT_OUT, focus: [] });
  expect(parseDiagramArgs(["--focus", "food, unit", "--out", "x.html"])).toEqual({ out: "x.html", focus: ["food", "unit"] });
  expect(() => parseDiagramArgs(["--focus"])).toThrow(/needs a value/);
  expect(() => parseDiagramArgs(["--nope"])).toThrow(/Unknown argument/);
});
