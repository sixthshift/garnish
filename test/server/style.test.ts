// The house style server functions (M37.2). The database these run against is
// seeded on open, so the guide starts with the fourteen default statements.
import { isNotFound } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { DEFAULT_STYLE_RULES } from "../../src/db/seed/style";
import type { NotFoundData } from "../../src/server/fn";
import { createStyleRule, deleteStyleRule, listStyleRules, reorderStyleRules, updateStyleRule } from "../../src/server/style";
import { callServerFn, useTempDataDir } from "../helpers/server";

useTempDataDir();

const MISSING = "00000000-0000-4000-8000-000000000000";

test("the guide reads back as the seeded statements, in order, ten of them on", async () => {
  const rules = await callServerFn(listStyleRules);
  expect(rules.map((r) => r.text)).toEqual(DEFAULT_STYLE_RULES.map((r) => r.text));
  expect(rules.map((r) => r.position)).toEqual(DEFAULT_STYLE_RULES.map((_, i) => i));
  expect(rules.filter((r) => r.enabled)).toHaveLength(10);
});

test("create adds a statement at the foot, on by default and trimmed", async () => {
  const made = await callServerFn(createStyleRule, { text: "  Name the pan.  " });
  expect(made).toMatchObject({ text: "Name the pan.", enabled: true, position: DEFAULT_STYLE_RULES.length });
  const rules = await callServerFn(listStyleRules);
  expect(rules.at(-1)).toEqual(made);
});

test("update edits the text and the switch, one field at a time", async () => {
  const made = await callServerFn(createStyleRule, { text: "Name the pan." });
  const off = await callServerFn(updateStyleRule, { id: made.id, enabled: false });
  expect(off).toMatchObject({ id: made.id, text: "Name the pan.", enabled: false });
  const reworded = await callServerFn(updateStyleRule, { id: made.id, text: "Name the pan and its size." });
  expect(reworded).toMatchObject({ text: "Name the pan and its size.", enabled: false });
});

test("delete returns the removed statement and takes it off the guide", async () => {
  const made = await callServerFn(createStyleRule, { text: "Name the pan." });
  expect(await callServerFn(deleteStyleRule, { id: made.id })).toEqual(made);
  expect((await callServerFn(listStyleRules)).map((r) => r.id)).not.toContain(made.id);
});

test("update and delete of an unknown id are not-found errors", async () => {
  const caught = await callServerFn(updateStyleRule, { id: MISSING, enabled: true }).catch((e: unknown) => e);
  expect(isNotFound(caught)).toBe(true);
  expect((caught as { data: NotFoundData }).data).toMatchObject({ entity: "style rule", id: MISSING });
  const gone = await callServerFn(deleteStyleRule, { id: MISSING }).catch((e: unknown) => e);
  expect(isNotFound(gone)).toBe(true);
});

test("reorder sets positions from the given order and returns the guide in it", async () => {
  const before = await callServerFn(listStyleRules);
  const reversed = before.map((r) => r.id).reverse();
  const after = await callServerFn(reorderStyleRules, { ids: reversed });
  expect(after.map((r) => r.id)).toEqual(reversed);
  expect(after.map((r) => r.position)).toEqual(before.map((_, i) => i));
});

test("validation rejects a blank statement and a fractional position", async () => {
  await expect(callServerFn(createStyleRule, { text: "   " })).rejects.toThrow(/too_small|at least 1/);
  await expect(callServerFn(createStyleRule, { text: "x", position: 1.5 })).rejects.toThrow(/expected int|integer/);
  await expect(callServerFn(updateStyleRule, { enabled: true } as never)).rejects.toThrow(/expected string/);
});
