import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { migrate, openDatabase } from "../../src/db/migrate";
import { units, type UnitRepository } from "../../src/db/units";

let db: Database;
let repo: UnitRepository;
beforeEach(async () => {
  db = openDatabase(":memory:");
  await migrate(db);
  repo = units(db);
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
  const kilogram = repo.create({ name: "kilogram", abbreviation: "kg", useAbbreviation: true, fraction: false, standardQuantity: 1000, standardUnitId: gram.id });
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
  db.run("INSERT INTO component (id, recipe_id, position) VALUES ('c', 'r', 0)");
  db.run("INSERT INTO ingredient (id, component_id, position, quantity, unit_id) VALUES ('i', 'c', 0, 50, ?)", [gram.id]);

  expect(repo.remove(gram.id)).toBe(true);
  expect(repo.remove(gram.id)).toBe(false);
  expect(db.query<{ unit_id: string | null }, []>("SELECT unit_id FROM ingredient WHERE id = 'i'").get()?.unit_id).toBeNull();
  expect(db.query<{ yield_unit_id: string | null }, []>("SELECT yield_unit_id FROM recipe WHERE id = 'r'").get()?.yield_unit_id).toBeNull();
  expect(repo.get(kilogram.id)?.standardUnitId).toBeNull();
});
