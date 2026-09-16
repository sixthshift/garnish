import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../src/db/connection/open";
import { migrate } from "../../src/db/migrations/migrate";
import { type UnitRepository, unitRepository } from "../../src/db/models/unit/repo";
import { formatAmount } from "../../src/domain/ingredient";

let db: Database;
let repo: UnitRepository;
beforeEach(async () => {
  db = openDatabase(":memory:");
  migrate(db);
  repo = unitRepository(db);
});

test("create applies Mealie defaults and list returns by name", () => {
  const cup = repo.create({ name: "cup" });
  expect(cup).toEqual({
    id: cup.id,
    name: "cup",
    pluralName: null,
    abbreviation: "",
    useAbbreviation: false,
    fraction: true,
    standardQuantity: null,
    standardUnitId: null,
  });

  const gram = repo.create({ name: "gram", pluralName: "grams", abbreviation: "g", useAbbreviation: true, fraction: false });
  const kilogram = repo.create({
    name: "kilogram",
    abbreviation: "kg",
    useAbbreviation: true,
    fraction: false,
    standardQuantity: 1000,
    standardUnitId: gram.id,
  });
  expect(gram).toMatchObject({ abbreviation: "g", useAbbreviation: true, fraction: false });
  expect(kilogram).toMatchObject({ standardQuantity: 1000, standardUnitId: gram.id });

  expect(repo.list().map((u) => u.name)).toEqual(["cup", "gram", "kilogram"]);
  expect(repo.get(gram.id)).toEqual(gram);
});

test("names collide case-insensitively; findOrCreate returns the match", () => {
  const gram = repo.create({ name: "Gram" });
  expect(() => repo.create({ name: "gram" })).toThrow(/UNIQUE/);
  expect(() => repo.create({ name: "GRAM" })).toThrow(/UNIQUE/);
  expect(repo.findOrCreate("gram")).toEqual(gram);
  expect(repo.findOrCreate(" GRAM ")).toEqual(gram);
  expect(repo.findOrCreate("cup").id).not.toBe(gram.id);
  expect(repo.list()).toHaveLength(2);
});

test("update merges a patch and returns null for unknown ids", () => {
  const gram = repo.create({ name: "gram" });
  repo.create({ name: "cup" });
  expect(repo.update(gram.id, { abbreviation: "g", useAbbreviation: true })).toEqual({ ...gram, abbreviation: "g", useAbbreviation: true });
  expect(() => repo.update(gram.id, { name: "Cup" })).toThrow(/UNIQUE/);
  expect(repo.update("missing", { abbreviation: "x" })).toBeNull();
});

test("remove nulls ingredient, recipe yield and standard-unit references", () => {
  const gram = repo.create({ name: "gram" });
  const kilogram = repo.create({ name: "kilogram", standardQuantity: 1000, standardUnitId: gram.id });
  db.run("INSERT INTO recipe (id, slug, name, yield_unit_id) VALUES ('r', 'r', 'R', ?)", [gram.id]);
  db.run("INSERT INTO part (id, recipe_id, position) VALUES ('c', 'r', 0)");
  db.run("INSERT INTO ingredient (id, part_id, position, quantity, unit_id) VALUES ('i', 'c', 0, 50, ?)", [gram.id]);

  expect(repo.remove(gram.id)).toBe(true);
  expect(repo.remove(gram.id)).toBe(false);
  expect(db.query<{ unit_id: string | null }, []>("SELECT unit_id FROM ingredient WHERE id = 'i'").get()?.unit_id).toBeNull();
  expect(db.query<{ yield_unit_id: string | null }, []>("SELECT yield_unit_id FROM recipe WHERE id = 'r'").get()?.yield_unit_id).toBeNull();
  expect(repo.get(kilogram.id)?.standardUnitId).toBeNull();
});

test("list with q filters by case-insensitive substring", () => {
  repo.create({ name: "Cup" });
  repo.create({ name: "teacup" });
  repo.create({ name: "gram" });
  expect(repo.list("CUP").map((u) => u.name)).toEqual(["Cup", "teacup"]);
  expect(repo.list("").map((u) => u.name)).toHaveLength(3);
  expect(repo.list("x_y")).toEqual([]);
});

test("merge repoints ingredient rows and recipe yield to the target and deletes the source", () => {
  const gram = repo.create({ name: "gram", abbreviation: "g", useAbbreviation: true, fraction: false });
  const kg = repo.create({ name: "kilogram", pluralName: "kilograms", abbreviation: "kg", useAbbreviation: true, fraction: false });
  db.run("INSERT INTO recipe (id, slug, name, yield_quantity, yield_unit_id) VALUES ('r', 'r', 'R', 2, ?)", [kg.id]);
  db.run("INSERT INTO part (id, recipe_id, position) VALUES ('c', 'r', 0)");
  db.run("INSERT INTO ingredient (id, part_id, position, quantity, unit_id, original_text) VALUES ('i1', 'c', 0, 500, ?, '500 kg flour')", [kg.id]);
  db.run("INSERT INTO ingredient (id, part_id, position, quantity, unit_id, original_text) VALUES ('i2', 'c', 1, 10, ?, '10 g salt')", [gram.id]);

  const merged = repo.merge(kg.id, gram.id);
  expect(merged).toEqual(gram);
  expect(repo.get(kg.id)).toBeNull();
  expect(repo.list().map((u) => u.name)).toEqual(["gram"]);

  const unitIds = db.query<{ id: string; unit_id: string | null }, []>("SELECT id, unit_id FROM ingredient ORDER BY id").all();
  expect(unitIds).toEqual([
    { id: "i1", unit_id: gram.id },
    { id: "i2", unit_id: gram.id },
  ]);
  expect(db.query<{ yield_unit_id: string | null }, []>("SELECT yield_unit_id FROM recipe WHERE id = 'r'").get()?.yield_unit_id).toBe(gram.id);
});

test("merge is transactional and unknown ids return null without changing anything", () => {
  const gram = repo.create({ name: "gram" });
  expect(repo.merge("missing", gram.id)).toBeNull();
  expect(repo.merge(gram.id, "missing")).toBeNull();
  expect(repo.list()).toEqual([gram]);
});

test("merging a unit into itself is a no-op that returns it unchanged", () => {
  const gram = repo.create({ name: "gram" });
  expect(repo.merge(gram.id, gram.id)).toEqual(gram);
  expect(repo.list()).toEqual([gram]);
});

test("a merged unit renders through formatAmount correctly", () => {
  const gram = repo.create({ name: "gram", pluralName: "grams", abbreviation: "g", useAbbreviation: true, fraction: false });
  const kg = repo.create({ name: "kilogram", abbreviation: "kg", useAbbreviation: true, fraction: false });

  const merged = repo.merge(kg.id, gram.id)!;
  expect(formatAmount(500, merged)).toBe("500 g");
  // The abbreviation is shown regardless of quantity; only the number vanishes.
  expect(formatAmount(null, merged)).toBe("g");
});
