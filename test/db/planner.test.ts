// The planner repository (M39.2): the guide, which is the house style guide's
// list again — read in position order, edited in place, moved and deleted —
// and the three meal rows the migration seeds.
import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../src/db/connection/open";
import { migrate } from "../../src/db/migrations/migrate";
import { type PlannerRepository, plannerRepository } from "../../src/db/models/planner/repo";

let db: Database;
let repo: PlannerRepository;
beforeEach(async () => {
  db = openDatabase(":memory:");
  migrate(db);
  repo = plannerRepository(db);
});

test("create appends to the foot, on by default, trimmed, and round-trips through get", () => {
  const first = repo.rules.create({ text: "  Vary the week.  " });
  const second = repo.rules.create({ text: "Two vegetarian dinners a week.", enabled: false });
  expect(first).toMatchObject({ text: "Vary the week.", position: 0, enabled: true });
  expect(second).toMatchObject({ text: "Two vegetarian dinners a week.", position: 1, enabled: false });
  expect(repo.rules.get(first.id)).toEqual(first);
  expect(repo.rules.get("missing")).toBeNull();
  expect(first.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(first.updatedAt).toBe(first.createdAt);
});

test("an explicit position is honoured, list reads in position order, and the next append clears the highest", () => {
  repo.rules.create({ text: "second", position: 2 });
  repo.rules.create({ text: "first", position: 1 });
  expect(repo.rules.list().map((r) => r.text)).toEqual(["first", "second"]);
  expect(repo.rules.create({ text: "third" })).toMatchObject({ position: 3 });
});

test("update edits the text, flips the switch and stamps updated_at; unknown id is null", () => {
  const rule = repo.rules.create({ text: "Favour produce in season." });
  const reworded = repo.rules.update(rule.id, { text: "  Favour produce in season here.  " })!;
  expect(reworded).toMatchObject({ id: rule.id, text: "Favour produce in season here.", enabled: true });
  expect(reworded.updatedAt >= rule.updatedAt).toBe(true);
  expect(reworded.createdAt).toBe(rule.createdAt);

  const off = repo.rules.update(rule.id, { enabled: false })!;
  expect(off).toMatchObject({ text: "Favour produce in season here.", enabled: false });
  expect(repo.rules.update("missing", { enabled: true })).toBeNull();
});

test("remove deletes the row once", () => {
  const rule = repo.rules.create({ text: "Quick weeknights." });
  expect(repo.rules.remove(rule.id)).toBe(true);
  expect(repo.rules.remove(rule.id)).toBe(false);
  expect(repo.rules.list()).toEqual([]);
});

test("reorder sets positions from the given order and returns the guide in it", () => {
  const one = repo.rules.create({ text: "one" });
  const two = repo.rules.create({ text: "two" });
  const three = repo.rules.create({ text: "three" });
  expect(repo.rules.reorder([three.id, one.id, two.id]).map((r) => r.text)).toEqual(["three", "one", "two"]);
  expect(repo.rules.list().map((r) => r.position)).toEqual([0, 1, 2]);
  // An unknown id in the list moves nothing and fails nothing.
  expect(repo.rules.reorder([one.id, "missing", two.id, three.id]).map((r) => r.text)).toEqual(["one", "two", "three"]);
});

test("the migration seeds the three meals, dinner on, in the order a day eats them", () => {
  expect(repo.meals.list()).toEqual([
    { meal: "breakfast", enabled: false },
    { meal: "lunch", enabled: false },
    { meal: "dinner", enabled: true },
  ]);
});

test("set writes the meals given, leaves the others alone and answers all three", () => {
  expect(repo.meals.set([{ meal: "lunch", enabled: true }])).toEqual([
    { meal: "breakfast", enabled: false },
    { meal: "lunch", enabled: true },
    { meal: "dinner", enabled: true },
  ]);
  expect(
    repo.meals.set([
      { meal: "dinner", enabled: false },
      { meal: "breakfast", enabled: true },
    ])
  ).toEqual([
    { meal: "breakfast", enabled: true },
    { meal: "lunch", enabled: true },
    { meal: "dinner", enabled: false },
  ]);
  // Setting the same value again is not an error and changes nothing.
  expect(repo.meals.set([{ meal: "lunch", enabled: true }])).toEqual(repo.meals.list());
});
