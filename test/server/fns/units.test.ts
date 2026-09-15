import { isNotFound } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { recipeInputSchema } from "../../../src/domain/recipe";
import { DEFAULT_UNITS } from "../../../src/db/seed/units";
import type { NotFoundData } from "../../../src/server/core/fn";
import { createRecipe } from "../../../src/server/fns/recipes";
import { createUnit, deleteUnit, findOrCreateUnit, listUnits, mergeUnit, updateUnit, usingUnit } from "../../../src/server/fns/units";
import { callServerFn, useTempDataDir } from "../../helpers/server";

useTempDataDir();

const MISSING = "00000000-0000-4000-8000-000000000000";

test("create applies Mealie defaults; list is by name and filters on q", async () => {
  const dash = await callServerFn(createUnit, { name: " Dash " });
  expect(dash).toMatchObject({ name: "Dash", pluralName: null, abbreviation: "", useAbbreviation: false, fraction: true, standardQuantity: null, standardUnitId: null });
  await callServerFn(createUnit, { name: "teacup", abbreviation: "tc", useAbbreviation: true });

  expect(await callServerFn(listUnits, {})).toHaveLength(DEFAULT_UNITS.length + 2);
  expect((await callServerFn(listUnits, { q: "CUP" })).map((u) => u.name)).toEqual(["cup", "teacup"]);
  expect(await callServerFn(listUnits, { q: "nothing" })).toEqual([]);
});

test("update merges a patch and keeps untouched fields", async () => {
  const [gram] = await callServerFn(listUnits, { q: "gram" });
  const unit = await callServerFn(createUnit, { name: "handful", pluralName: "handfuls" });
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
  const unit = await callServerFn(createUnit, { name: "smidgen" });
  expect(await callServerFn(deleteUnit, { id: unit.id })).toEqual(unit);
  expect(await callServerFn(listUnits, { q: "smidgen" })).toEqual([]);
});

test("findOrCreate returns the case-insensitive match, else a new row", async () => {
  const [gram] = await callServerFn(listUnits, { q: "gram" });
  expect(await callServerFn(findOrCreateUnit, { name: " GRAM " })).toEqual(gram);
  const knob = await callServerFn(findOrCreateUnit, { name: "knob" });
  expect(knob.name).toBe("knob");
  expect(await callServerFn(listUnits, {})).toHaveLength(DEFAULT_UNITS.length + 1);
});

test("validation rejects a blank name, a negative quantity and wrong types", async () => {
  await expect(callServerFn(createUnit, { name: "" })).rejects.toThrow(/too_small|at least 1/);
  await expect(callServerFn(createUnit, { name: "x", standardQuantity: -1 })).rejects.toThrow(/too_small|>=0/);
  await expect(callServerFn(createUnit, { name: "x", fraction: "yes" } as never)).rejects.toThrow(/expected boolean/);
});

test("usingUnit lists the recipes with an ingredient or a yield of that unit", async () => {
  const [gram] = await callServerFn(listUnits, { q: "gram" });
  await callServerFn(
    createRecipe,
    recipeInputSchema.parse({ name: "Bread", parts: [{ name: "", ingredients: [{ unit: gram, quantity: 500 }], steps: [] }] }),
  );
  expect((await callServerFn(usingUnit, { id: gram!.id })).map((r) => r.name)).toEqual(["Bread"]);

  const [cup] = await callServerFn(listUnits, { q: "cup" });
  await callServerFn(
    createRecipe,
    recipeInputSchema.parse({ name: "Muffins", yieldUnit: cup, recipeYieldQuantity: 12, parts: [{ name: "", ingredients: [], steps: [] }] }),
  );
  expect((await callServerFn(usingUnit, { id: cup!.id })).map((r) => r.name)).toEqual(["Muffins"]);

  const knob = await callServerFn(createUnit, { name: "knob" });
  expect(await callServerFn(usingUnit, { id: knob.id })).toEqual([]);
});

test("mergeUnit repoints ingredients and recipe yields to the target, deletes the source, and drops it from the list", async () => {
  const [gram] = await callServerFn(listUnits, { q: "gram" });
  const stone = await callServerFn(createUnit, { name: "stone", abbreviation: "st", useAbbreviation: true, fraction: false });
  await callServerFn(
    createRecipe,
    recipeInputSchema.parse({ name: "Sourdough", parts: [{ name: "", ingredients: [{ unit: stone, quantity: 1 }], steps: [] }] }),
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
