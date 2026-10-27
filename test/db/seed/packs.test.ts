// The starter sizes (decisions.md row 184): every food and unit they name is
// one the earlier batches make, they are applied once, and a food the
// household has already sized or renamed is left alone.
import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../../src/db/connection/open";
import { migrate } from "../../../src/db/migrations/migrate";
import { foodRepository } from "../../../src/db/models/food/repo";
import { unitRepository } from "../../../src/db/models/unit/repo";
import { correctedStarterFoods } from "../../../src/db/seed/foodPlurals";
import { STARTER_PACKS, seedStarterPacks } from "../../../src/db/seed/packs";
import { seed } from "../../../src/db/seed/seed";
import { DEFAULT_UNITS } from "../../../src/db/seed/units";

let db: Database;
beforeEach(async () => {
  db = openDatabase(":memory:");
  migrate(db);
});

test("every food is a starter food, once, and every unit a default unit", () => {
  const foods = new Set(correctedStarterFoods().map((food) => food.name));
  expect(STARTER_PACKS.filter((pack) => !foods.has(pack.food)).map((pack) => pack.food)).toEqual([]);
  expect(new Set(STARTER_PACKS.map((pack) => pack.food)).size).toBe(STARTER_PACKS.length);
  const units = new Set(DEFAULT_UNITS.map((unit) => unit.name));
  expect(STARTER_PACKS.flatMap((pack) => pack.sizes.map(([, unit]) => unit)).filter((unit) => unit !== null && !units.has(unit))).toEqual([]);
});

test("a new database gets every starter size, once", () => {
  const first = seed(db);
  expect(first.packedFoods).toHaveLength(STARTER_PACKS.length);
  const foods = foodRepository(db);
  const butter = foods.list().find((food) => food.name === "butter")!;
  const gram = unitRepository(db)
    .list()
    .find((unit) => unit.name === "gram")!;
  expect(foods.packsOf(butter.id)).toMatchObject([
    { quantity: 250, unitId: gram.id },
    { quantity: 500, unitId: gram.id },
  ]);
  const egg = foods.list().find((food) => food.name === "egg")!;
  expect(foods.packsOf(egg.id)).toMatchObject([
    { quantity: 6, unitId: null },
    { quantity: 12, unitId: null },
  ]);

  // A size the household removes stays removed.
  foods.setPacks(butter.id, []);
  expect(seed(db).packedFoods).toEqual([]);
  expect(foods.packsOf(butter.id)).toEqual([]);
});

test("a food with sizes of its own, or renamed, is left alone; a database without the food is fine", () => {
  const foods = foodRepository(db);
  const kg = unitRepository(db).create({ name: "kilogram", abbreviation: "kg" });
  const butter = foods.create({ name: "butter" });
  foods.setPacks(butter.id, [{ quantity: 1, unitId: kg.id }]);
  foods.create({ name: "full cream milk" }); // "milk", renamed
  unitRepository(db).create({ name: "gram", abbreviation: "g" });

  expect(seedStarterPacks(db)).toEqual([]);
  expect(foods.packsOf(butter.id)).toMatchObject([{ quantity: 1, unitId: kg.id }]);
});
