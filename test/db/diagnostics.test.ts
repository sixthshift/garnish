// The diagnostics repository (020_diagnostics.sql): what went wrong, newest
// first, with its detail read back as the object it was written as, and only
// the newest few hundred kept.
import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../src/db/connection/open";
import { migrate } from "../../src/db/migrations/migrate";
import { type DiagnosticInput, type DiagnosticRepository, diagnosticRepository } from "../../src/db/models/diagnostic/repo";

let db: Database;
let repo: DiagnosticRepository;
beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  repo = diagnosticRepository(db, { kept: 3 });
});

const event = (over: Partial<DiagnosticInput> = {}): DiagnosticInput => ({
  source: "server",
  level: "error",
  name: "createRecipe",
  message: "boom",
  detail: { stack: "Error: boom\n    at x" },
  version: "1.4.1 (abc1234)",
  ...over,
});

test("record keeps an event and hands it back with an id, a time and its detail as an object", () => {
  const kept = repo.record(event({ occurredAt: "2026-10-11T01:00:00.000Z" }));
  expect(kept).toMatchObject({ source: "server", level: "error", name: "createRecipe", message: "boom", version: "1.4.1 (abc1234)" });
  expect(kept.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(kept.occurredAt).toBe("2026-10-11T01:00:00.000Z");
  expect(kept.detail).toEqual({ stack: "Error: boom\n    at x" });
  expect(repo.record(event({ detail: null })).detail).toBeNull();
});

test("list is newest first, ties broken by insertion, and limited", () => {
  repo.record(event({ message: "first", occurredAt: "2026-10-11T01:00:00.000Z" }));
  repo.record(event({ message: "third", occurredAt: "2026-10-11T03:00:00.000Z" }));
  repo.record(event({ message: "second", occurredAt: "2026-10-11T02:00:00.000Z" }));
  expect(repo.list().map((row) => row.message)).toEqual(["third", "second", "first"]);
  expect(repo.list(1).map((row) => row.message)).toEqual(["third"]);
});

test("only the newest `kept` survive a record, so a failure loop cannot grow the database", () => {
  for (let hour = 1; hour <= 5; hour++) repo.record(event({ message: `e${hour}`, occurredAt: `2026-10-11T0${hour}:00:00.000Z` }));
  expect(repo.count()).toBe(3);
  expect(repo.list().map((row) => row.message)).toEqual(["e5", "e4", "e3"]);
});

test("the column refuses a source or level it does not know", () => {
  expect(() => repo.record(event({ source: "cron" as never }))).toThrow();
  expect(() => repo.record(event({ level: "info" as never }))).toThrow();
});

test("clear forgets every event", () => {
  repo.record(event());
  repo.record(event());
  repo.clear();
  expect(repo.count()).toBe(0);
  expect(repo.list()).toEqual([]);
});
