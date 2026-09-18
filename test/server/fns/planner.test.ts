// The planner server functions (M39.2). The database these run against is
// seeded on open, so the guide starts with the seven default statements. The
// meal switches went with M39.7: which meals a week plans for is chosen on the
// proposal sheet now.
import { isNotFound } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { DEFAULT_PLANNER_RULES } from "../../../src/db/seed/planner";
import type { NotFoundData } from "../../../src/server/core/fn";
import { createPlannerRule, deletePlannerRule, listPlannerRules, reorderPlannerRules, updatePlannerRule } from "../../../src/server/fns/planner";
import { callServerFn, useTempDataDir } from "../../helpers/server";

useTempDataDir();

const MISSING = "00000000-0000-4000-8000-000000000000";

test("the guide reads back as the seeded statements, in order, five of seven on", async () => {
  const rules = await callServerFn(listPlannerRules);
  expect(rules.map((r) => r.text)).toEqual(DEFAULT_PLANNER_RULES.map((r) => r.text));
  expect(rules.map((r) => r.position)).toEqual(DEFAULT_PLANNER_RULES.map((_, i) => i));
  expect(rules.filter((r) => r.enabled)).toHaveLength(5);
});

test("create adds a statement at the foot, on by default and trimmed", async () => {
  const made = await callServerFn(createPlannerRule, { text: "  No takeaway on a Thursday.  " });
  expect(made).toMatchObject({ text: "No takeaway on a Thursday.", enabled: true, position: DEFAULT_PLANNER_RULES.length });
  const rules = await callServerFn(listPlannerRules);
  expect(rules.at(-1)).toEqual(made);
});

test("update edits the text and the switch, one field at a time", async () => {
  const made = await callServerFn(createPlannerRule, { text: "No takeaway on a Thursday." });
  const off = await callServerFn(updatePlannerRule, { id: made.id, enabled: false });
  expect(off).toMatchObject({ id: made.id, text: "No takeaway on a Thursday.", enabled: false });
  const reworded = await callServerFn(updatePlannerRule, { id: made.id, text: "No takeaway midweek." });
  expect(reworded).toMatchObject({ text: "No takeaway midweek.", enabled: false });
});

test("delete returns the removed statement and takes it off the guide", async () => {
  const made = await callServerFn(createPlannerRule, { text: "No takeaway on a Thursday." });
  expect(await callServerFn(deletePlannerRule, { id: made.id })).toEqual(made);
  expect((await callServerFn(listPlannerRules)).map((r) => r.id)).not.toContain(made.id);
});

test("update and delete of an unknown id are not-found errors", async () => {
  const caught = await callServerFn(updatePlannerRule, { id: MISSING, enabled: true }).catch((e: unknown) => e);
  expect(isNotFound(caught)).toBe(true);
  expect((caught as { data: NotFoundData }).data).toMatchObject({ entity: "planner rule", id: MISSING });
  const gone = await callServerFn(deletePlannerRule, { id: MISSING }).catch((e: unknown) => e);
  expect(isNotFound(gone)).toBe(true);
});

test("reorder sets positions from the given order and returns the guide in it", async () => {
  const rules = await callServerFn(listPlannerRules);
  const ids = rules.map((r) => r.id);
  const moved = await callServerFn(reorderPlannerRules, { ids: [ids.at(-1)!, ...ids.slice(0, -1)] });
  expect(moved.map((r) => r.text)).toEqual([DEFAULT_PLANNER_RULES.at(-1)!.text, ...DEFAULT_PLANNER_RULES.slice(0, -1).map((r) => r.text)]);
  expect(moved.map((r) => r.position)).toEqual(moved.map((_, i) => i));
});
