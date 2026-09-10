import { isNotFound } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { createAisle, deleteAisle, findOrCreateAisle, listAisles, updateAisle } from "../../src/server/aisles";
import type { NotFoundData } from "../../src/server/fn";
import { createFood, listFoods } from "../../src/server/foods";
import { callServerFn, useTempDataDir } from "../helpers/server";

useTempDataDir();

const MISSING = "00000000-0000-4000-8000-000000000000";

test("create appends to the end; list is in position order and filters on q", async () => {
  const frozen = await callServerFn(createAisle, { name: " Frozen " });
  expect(frozen).toMatchObject({ name: "Frozen", position: 0 });
  await callServerFn(createAisle, { name: "Dairy" });
  await callServerFn(createAisle, { name: "Deli & Dairy", position: 5 });

  expect((await callServerFn(listAisles, {})).map((a) => a.name)).toEqual(["Frozen", "Dairy", "Deli & Dairy"]);
  expect((await callServerFn(listAisles, { q: "DAI" })).map((a) => a.name)).toEqual(["Dairy", "Deli & Dairy"]);
  expect(await callServerFn(listAisles, { q: "meat" })).toEqual([]);
});

test("update renames and reorders, keeping untouched fields", async () => {
  const aisle = await callServerFn(createAisle, { name: "Bakery", position: 3 });
  expect(await callServerFn(updateAisle, { id: aisle.id, name: "Bread" })).toEqual({ ...aisle, name: "Bread" });
  expect(await callServerFn(updateAisle, { id: aisle.id, position: 0 })).toEqual({ ...aisle, name: "Bread", position: 0 });
});

test("update and delete of an unknown id are not-found errors", async () => {
  const caught = await callServerFn(updateAisle, { id: MISSING, name: "x" }).catch((e: unknown) => e);
  expect(isNotFound(caught)).toBe(true);
  expect((caught as { data: NotFoundData }).data).toMatchObject({ entity: "aisle", id: MISSING });
  const gone = await callServerFn(deleteAisle, { id: MISSING }).catch((e: unknown) => e);
  expect(isNotFound(gone)).toBe(true);
});

test("delete returns the removed row and leaves its foods with no aisle", async () => {
  const aisle = await callServerFn(createAisle, { name: "Produce" });
  await callServerFn(createFood, { name: "apple", aisleId: aisle.id });
  expect(await callServerFn(deleteAisle, { id: aisle.id })).toEqual(aisle);
  expect(await callServerFn(listAisles, {})).toEqual([]);
  expect((await callServerFn(listFoods, {}))[0]).toMatchObject({ name: "apple", aisleId: null });
});

test("findOrCreate returns the case-insensitive match, else a new row at the end", async () => {
  const pantry = await callServerFn(createAisle, { name: "Pantry" });
  expect(await callServerFn(findOrCreateAisle, { name: " pantry " })).toEqual(pantry);
  expect(await callServerFn(findOrCreateAisle, { name: "Spices" })).toMatchObject({ name: "Spices", position: 1 });
});

test("validation rejects a blank name and a fractional position", async () => {
  await expect(callServerFn(createAisle, { name: " " })).rejects.toThrow(/too_small|at least 1/);
  await expect(callServerFn(createAisle, { name: "x", position: 1.5 })).rejects.toThrow(/expected int|integer/);
  await expect(callServerFn(updateAisle, { name: "x" } as never)).rejects.toThrow(/expected string/);
});
