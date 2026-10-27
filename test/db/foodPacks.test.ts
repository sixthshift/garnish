// The sizes a food is sold in (decisions.md row 184), against the real
// migrations: replaced wholesale, smallest first, and gone with their food or
// their unit.
import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../src/db/connection/open";
import { migrate } from "../../src/db/migrations/migrate";
import { type FoodRepository, foodRepository } from "../../src/db/models/food/repo";
import { unitRepository } from "../../src/db/models/unit/repo";

let db: Database;
let foods: FoodRepository;
beforeEach(async () => {
  db = openDatabase(":memory:");
  migrate(db);
  foods = foodRepository(db);
});

test("sizes round-trip smallest first, are replaced wholesale, and 'each' is a null unit", () => {
  const gram = unitRepository(db).create({ name: "gram", abbreviation: "g" });
  const butter = foods.create({ name: "butter" });
  const egg = foods.create({ name: "egg" });

  expect(
    foods.setPacks(butter.id, [
      { quantity: 500, unitId: gram.id },
      { quantity: 250, unitId: gram.id },
    ])
  ).toMatchObject([
    { foodId: butter.id, quantity: 250, unitId: gram.id },
    { foodId: butter.id, quantity: 500, unitId: gram.id },
  ]);
  foods.setPacks(egg.id, [{ quantity: 12, unitId: null }]);
  expect(foods.packs().map((pack) => [pack.foodId, pack.quantity])).toEqual(
    expect.arrayContaining([
      [butter.id, 250],
      [butter.id, 500],
      [egg.id, 12],
    ])
  );

  expect(foods.setPacks(butter.id, [{ quantity: 250, unitId: gram.id }])).toHaveLength(1);
  expect(foods.setPacks(butter.id, [])).toEqual([]);
  expect(foods.setPacks("11111111-1111-4111-8111-111111111111", [])).toBeNull();
});

test("a size goes with its food and with its unit", () => {
  const gram = unitRepository(db).create({ name: "gram", abbreviation: "g" });
  const butter = foods.create({ name: "butter" });
  const egg = foods.create({ name: "egg" });
  foods.setPacks(butter.id, [{ quantity: 250, unitId: gram.id }]);
  foods.setPacks(egg.id, [{ quantity: 6, unitId: null }]);

  expect(unitRepository(db).remove(gram.id)).toBe(true);
  expect(foods.packsOf(butter.id)).toEqual([]);
  expect(foods.remove(egg.id)).toBe(true);
  expect(foods.packs()).toEqual([]);
});

test("a size must be above zero", () => {
  const butter = foods.create({ name: "butter" });
  expect(() => foods.setPacks(butter.id, [{ quantity: 0, unitId: null }])).toThrow();
});
