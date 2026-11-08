import { isNotFound } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { createRecipe } from "../../../src/api/rpc/recipes";
import { deleteUnit, listUnits, mergeUnit, updateUnit, usingUnit } from "../../../src/api/rpc/units";
import unitRepo from "../../../src/db/models/unit/repo";
import { DEFAULT_UNITS } from "../../../src/db/seed/units";
import { recipeInputSchema } from "../../../src/domain/recipes/recipe";
import { UnitCreate } from "../../../src/domain/recipes/reference";
import type { NotFoundData } from "../../../src/server/core/fn";
import { callServerFn, useTempDataDir } from "../../helpers/server";

useTempDataDir();

const newUnit = (input: unknown) => unitRepo.create(UnitCreate.parse(input));

const MISSING = "00000000-0000-4000-8000-000000000000";

test("create applies Mealie defaults; list is by name and filters on q", async () => {
  const dash = newUnit({ name: " Dash " });
  expect(dash).toMatchObject({
    name: "Dash",
    pluralName: null,
    abbreviation: "",
    useAbbreviation: false,
    fraction: true,
    standardQuantity: null,
    standardUnitId: null,
  });
  newUnit({ name: "teacup", abbreviation: "tc", useAbbreviation: true });

  expect(await callServerFn(listUnits, {})).toHaveLength(DEFAULT_UNITS.length + 2);
  expect((await callServerFn(listUnits, { q: "CUP" })).map((u) => u.name)).toEqual(["cup", "teacup"]);
  expect(await callServerFn(listUnits, { q: "nothing" })).toEqual([]);
});

test("update merges a patch and keeps untouched fields", async () => {
  const [gram] = await callServerFn(listUnits, { q: "gram" });
  const unit = newUnit({ name: "handful", pluralName: "handfuls" });
  const updated = await callServerFn(updateUnit, { id: unit.id, standardQuantity: 30, standardUnitId: gram!.id, fraction: false });
  expect(updated).toEqual({ ...unit, standardQuantity: 30, standardUnitId: gram!.id, fraction: false });
  expect(await callServerFn(updateUnit, { id: unit.id, name: "Handful" })).toMatchObject({ name: "Handful", pluralName: "handfuls", standardQuantity: 30 });
});

test("update and delete of an unknown id are not-found errors", async () => {
  const caught = await callServerFn(updateUnit, { id: MISSING, name: "x" }).catch((e: unknown) => e);
  expect(isNotFound(caught)).toBe(true);
  expect((caught as { data: NotFoundData }).data).toMatchObject({ entity: "unit", id: MISSING });
  const gone = await callServerFn(deleteUnit, { id: MISSING }).catch((e: unknown) => e);
  expect(isNotFound(gone)).toBe(true);
});

test("delete returns the removed row and the list no longer has it", async () => {
  const unit = newUnit({ name: "smidgen" });
  expect(await callServerFn(deleteUnit, { id: unit.id })).toEqual(unit);
  expect(await callServerFn(listUnits, { q: "smidgen" })).toEqual([]);
});

test("findOrCreate returns the case-insensitive match, else a new row", async () => {
  const [gram] = await callServerFn(listUnits, { q: "gram" });
  expect(unitRepo.findOrCreate(" GRAM ")).toEqual(gram);
  const knob = unitRepo.findOrCreate("knob");
  expect(knob.name).toBe("knob");
  expect(await callServerFn(listUnits, {})).toHaveLength(DEFAULT_UNITS.length + 1);
});

test("validation rejects a blank name, a negative quantity and wrong types", async () => {
  expect(() => newUnit({ name: "" })).toThrow(/too_small|at least 1/);
  expect(() => newUnit({ name: "x", standardQuantity: -1 })).toThrow(/too_small|>=0/);
  expect(() => newUnit({ name: "x", fraction: "yes" } as never)).toThrow(/expected boolean/);
});

test("usingUnit lists the recipes with an ingredient or a yield of that unit", async () => {
  const [gram] = await callServerFn(listUnits, { q: "gram" });
  await callServerFn(createRecipe, recipeInputSchema.parse({ name: "Bread", parts: [{ name: "", ingredients: [{ unit: gram, quantity: 500 }], steps: [] }] }));
  expect((await callServerFn(usingUnit, { id: gram!.id })).map((r) => r.name)).toEqual(["Bread"]);

  const [cup] = await callServerFn(listUnits, { q: "cup" });
  await callServerFn(
    createRecipe,
    recipeInputSchema.parse({ name: "Muffins", yieldUnit: cup, recipeYieldQuantity: 12, parts: [{ name: "", ingredients: [], steps: [] }] })
  );
  expect((await callServerFn(usingUnit, { id: cup!.id })).map((r) => r.name)).toEqual(["Muffins"]);

  const knob = newUnit({ name: "knob" });
  expect(await callServerFn(usingUnit, { id: knob.id })).toEqual([]);
});

test("mergeUnit repoints ingredients and recipe yields to the target, deletes the source, and drops it from the list", async () => {
  const [gram] = await callServerFn(listUnits, { q: "gram" });
  const stone = newUnit({ name: "stone", abbreviation: "st", useAbbreviation: true, fraction: false });
  await callServerFn(
    createRecipe,
    recipeInputSchema.parse({ name: "Sourdough", parts: [{ name: "", ingredients: [{ unit: stone, quantity: 1 }], steps: [] }] })
  );

  const merged = await callServerFn(mergeUnit, { sourceId: stone.id, targetId: gram!.id });
  expect(merged).toEqual(gram);
  expect((await callServerFn(listUnits, { q: "stone" })).map((u) => u.name)).toEqual([]);
  expect((await callServerFn(usingUnit, { id: gram!.id })).map((r) => r.name)).toEqual(["Sourdough"]);
});

test("mergeUnit is not-found when either id is unknown", async () => {
  const [gram] = await callServerFn(listUnits, { q: "gram" });
  const missingSource = await callServerFn(mergeUnit, { sourceId: MISSING, targetId: gram!.id }).catch((e: unknown) => e);
  expect(isNotFound(missingSource)).toBe(true);
  expect((missingSource as { data: NotFoundData }).data).toMatchObject({ entity: "unit", id: MISSING });

  const missingTarget = await callServerFn(mergeUnit, { sourceId: gram!.id, targetId: MISSING }).catch((e: unknown) => e);
  expect(isNotFound(missingTarget)).toBe(true);
  expect((missingTarget as { data: NotFoundData }).data).toMatchObject({ entity: "unit", id: MISSING });
});
