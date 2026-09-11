import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { aisles, type AisleRepository } from "../../src/db/aisles";
import { foods } from "../../src/db/foods";
import { migrate, openDatabase } from "../../src/db/migrate";

let db: Database;
let repo: AisleRepository;
beforeEach(async () => {
  db = openDatabase(":memory:");
  await migrate(db);
  repo = aisles(db);
});

test("create appends to the end unless given a position; list is in position order", () => {
  const produce = repo.create({ name: "Produce" });
  const dairy = repo.create({ name: "Dairy" });
  const frozen = repo.create({ name: "Frozen", position: 0 });
  expect(produce.position).toBe(0);
  expect(dairy.position).toBe(1);
  expect(repo.list().map((a) => a.name)).toEqual(["Frozen", "Produce", "Dairy"]);
  expect(repo.get(frozen.id)).toEqual({ id: frozen.id, name: "Frozen", position: 0 });
});

test("names collide case-insensitively; findOrCreate returns the match", () => {
  const dairy = repo.create({ name: "Dairy" });
  expect(() => repo.create({ name: "dairy" })).toThrow(/UNIQUE/);
  expect(repo.findOrCreate("DAIRY")).toEqual(dairy);
  expect(repo.findOrCreate("Bakery")).toMatchObject({ name: "Bakery", position: 1 });
  expect(repo.list()).toHaveLength(2);
});

test("update renames and reorders; unknown id is null", () => {
  const dairy = repo.create({ name: "Dairy" });
  expect(repo.update(dairy.id, { name: "Chilled", position: 5 })).toEqual({ id: dairy.id, name: "Chilled", position: 5 });
  expect(repo.update("missing", { position: 1 })).toBeNull();
});

test("remove leaves foods in the aisle with aisle_id null", () => {
  const dairy = repo.create({ name: "Dairy" });
  const butter = foods(db).create({ name: "butter", aisleId: dairy.id });
  expect(repo.remove(dairy.id)).toBe(true);
  expect(repo.remove(dairy.id)).toBe(false);
  expect(foods(db).get(butter.id)?.aisleId).toBeNull();
});

test("list with q filters by case-insensitive substring, keeping position order", () => {
  repo.create({ name: "Frozen" });
  repo.create({ name: "Dairy" });
  repo.create({ name: "Deli & Dairy" });
  expect(repo.list("dai").map((a) => a.name)).toEqual(["Dairy", "Deli & Dairy"]);
  expect(repo.list().map((a) => a.name)).toEqual(["Frozen", "Dairy", "Deli & Dairy"]);
  expect(repo.list("meat")).toEqual([]);
});

test("reorder sets positions from the given order, in one go, and returns the new list order", () => {
  const frozen = repo.create({ name: "Frozen" });
  const dairy = repo.create({ name: "Dairy" });
  const produce = repo.create({ name: "Produce" });
  expect(repo.list().map((a) => a.name)).toEqual(["Frozen", "Dairy", "Produce"]);

  const reordered = repo.reorder([produce.id, frozen.id, dairy.id]);
  expect(reordered.map((a) => a.name)).toEqual(["Produce", "Frozen", "Dairy"]);
  expect(repo.get(produce.id)?.position).toBe(0);
  expect(repo.get(frozen.id)?.position).toBe(1);
  expect(repo.get(dairy.id)?.position).toBe(2);
});

test("reorder ignores an id that is not a real aisle", () => {
  const frozen = repo.create({ name: "Frozen" });
  const dairy = repo.create({ name: "Dairy" });
  expect(repo.reorder([dairy.id, "missing", frozen.id]).map((a) => a.name)).toEqual(["Dairy", "Frozen"]);
});
