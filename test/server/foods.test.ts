import { isNotFound } from "@tanstack/react-router";
import { expect, test } from "vitest";
import type { NotFoundData } from "../../src/server/fn";
import { createAisle } from "../../src/server/aisles";
import { createFood, deleteFood, findOrCreateFood, listFoods, updateFood } from "../../src/server/foods";
import { callServerFn, useTempDataDir } from "../helpers/server";

useTempDataDir();

const MISSING = "00000000-0000-4000-8000-000000000000";

test("create applies defaults; list is by name and filters on q", async () => {
  const butter = await callServerFn(createFood, { name: " Butter " });
  expect(butter).toMatchObject({ name: "Butter", pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false });
  await callServerFn(createFood, { name: "peanut butter", aliases: ["pb"], skipShopping: true });
  await callServerFn(createFood, { name: "salt" });

  expect((await callServerFn(listFoods, {})).map((f) => f.name)).toEqual(["Butter", "peanut butter", "salt"]);
  expect((await callServerFn(listFoods, { q: "BUTT" })).map((f) => f.name)).toEqual(["Butter", "peanut butter"]);
  expect(await callServerFn(listFoods, { q: "nothing" })).toEqual([]);
});

test("update merges a patch and keeps untouched fields", async () => {
  const dairy = await callServerFn(createAisle, { name: "Dairy" });
  const food = await callServerFn(createFood, { name: "milk", pluralName: "milks" });
  const updated = await callServerFn(updateFood, { id: food.id, aisleId: dairy.id, skipShopping: true });
  expect(updated).toEqual({ ...food, aisleId: dairy.id, skipShopping: true });
  expect(await callServerFn(updateFood, { id: food.id, name: "Full cream milk" })).toMatchObject({ name: "Full cream milk", pluralName: "milks" });
});

test("update and delete of an unknown id are not-found errors", async () => {
  const caught = await callServerFn(updateFood, { id: MISSING, name: "x" }).catch((e: unknown) => e);
  expect(isNotFound(caught)).toBe(true);
  expect((caught as { data: NotFoundData }).data).toMatchObject({ entity: "food", id: MISSING });
  const gone = await callServerFn(deleteFood, { id: MISSING }).catch((e: unknown) => e);
  expect(isNotFound(gone)).toBe(true);
});

test("delete returns the removed row and the list no longer has it", async () => {
  const food = await callServerFn(createFood, { name: "sugar" });
  expect(await callServerFn(deleteFood, { id: food.id })).toEqual(food);
  expect(await callServerFn(listFoods, {})).toEqual([]);
});

test("findOrCreate returns the case-insensitive match, else a new row", async () => {
  const flour = await callServerFn(createFood, { name: "Flour" });
  expect(await callServerFn(findOrCreateFood, { name: " flour " })).toEqual(flour);
  const yeast = await callServerFn(findOrCreateFood, { name: "yeast" });
  expect(yeast.name).toBe("yeast");
  expect(await callServerFn(listFoods, {})).toHaveLength(2);
});

test("validation rejects a blank name and wrong types before the handler", async () => {
  await expect(callServerFn(createFood, { name: "   " })).rejects.toThrow(/too_small|at least 1/);
  await expect(callServerFn(createFood, { name: "x", aliases: "pb" } as never)).rejects.toThrow(/expected array/);
  await expect(callServerFn(findOrCreateFood, {} as never)).rejects.toThrow(/expected string/);
});
