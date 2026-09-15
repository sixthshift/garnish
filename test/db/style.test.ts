// The house style repository (M37.2): one ordered list of statements, read in
// position order, edited in place, moved and deleted.
import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../src/db/connection/open";
import { migrate } from "../../src/db/migrations/migrate";
import { type StyleRuleRepository, styleRules } from "../../src/db/models/style/repo";

let db: Database;
let repo: StyleRuleRepository;
beforeEach(async () => {
  db = openDatabase(":memory:");
  await migrate(db);
  repo = styleRules(db);
});

test("create appends to the foot, on by default, and round-trips through get", () => {
  const first = repo.create({ text: "  One action per step.  " });
  const second = repo.create({ text: "No chatter.", enabled: false });
  expect(first).toMatchObject({ text: "One action per step.", position: 0, enabled: true });
  expect(second).toMatchObject({ text: "No chatter.", position: 1, enabled: false });
  expect(repo.get(first.id)).toEqual(first);
  expect(repo.get("missing")).toBeNull();
  expect(first.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(first.updatedAt).toBe(first.createdAt);
});

test("an explicit position is honoured, list reads in position order, and the next append clears the highest", () => {
  repo.create({ text: "second", position: 2 });
  repo.create({ text: "first", position: 1 });
  expect(repo.list().map((r) => r.text)).toEqual(["first", "second"]);
  expect(repo.create({ text: "third" })).toMatchObject({ position: 3 });
});

test("update edits the text, flips the switch and stamps updated_at; unknown id is null", () => {
  const rule = repo.create({ text: "Plain words." });
  const renamed = repo.update(rule.id, { text: "  Plain words, always.  " })!;
  expect(renamed).toMatchObject({ id: rule.id, text: "Plain words, always.", enabled: true });
  expect(renamed.updatedAt >= rule.updatedAt).toBe(true);
  expect(renamed.createdAt).toBe(rule.createdAt);

  const off = repo.update(rule.id, { enabled: false })!;
  expect(off).toMatchObject({ text: "Plain words, always.", enabled: false });
  expect(repo.update("missing", { enabled: true })).toBeNull();
});

test("remove deletes the row once", () => {
  const rule = repo.create({ text: "Short steps." });
  expect(repo.remove(rule.id)).toBe(true);
  expect(repo.remove(rule.id)).toBe(false);
  expect(repo.list()).toEqual([]);
});

test("reorder sets positions from the given order and returns the guide in it", () => {
  const one = repo.create({ text: "one" });
  const two = repo.create({ text: "two" });
  const three = repo.create({ text: "three" });
  expect(repo.reorder([three.id, one.id, two.id]).map((r) => r.text)).toEqual(["three", "one", "two"]);
  expect(repo.list().map((r) => r.position)).toEqual([0, 1, 2]);
  // An unknown id in the list moves nothing and fails nothing.
  expect(repo.reorder([three.id, "missing", one.id, two.id]).map((r) => r.text)).toEqual(["three", "one", "two"]);
});

test("a rule with the same text twice is allowed: the text is not a key", () => {
  repo.create({ text: "No chatter." });
  repo.create({ text: "No chatter." });
  expect(repo.list()).toHaveLength(2);
});
