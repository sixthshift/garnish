// The planner module's surface (M39.2): the statements a run reads out and
// the inputs the server functions validate with. The enum itself lives here now and `plan/` reads it from this module,
// which `test/domain/plan/plan.test.ts` still asserts from the other side.
import { expect, test } from "vitest";
import { enabledRules, MEALS, type PlannerRule, PlannerRuleCreate, PlannerRuleReorder, PlannerRuleUpdate } from "../../../src/domain/planner";

function rule(id: string, text: string, enabled: boolean, position: number): PlannerRule {
  return { id, position, text, enabled, createdAt: "2026-09-18T00:00:00.000Z", updatedAt: "2026-09-18T00:00:00.000Z" };
}

test("the three meals are breakfast, lunch and dinner, in the order a day eats them", () => {
  expect(MEALS).toEqual(["breakfast", "lunch", "dinner"]);
});

test("enabledRules keeps the switched-on statements in the order given", () => {
  const rules = [rule("a", "one", true, 0), rule("b", "two", false, 1), rule("c", "three", true, 2)];
  expect(enabledRules(rules).map((r) => r.text)).toEqual(["one", "three"]);
  expect(enabledRules([])).toEqual([]);
});

test("a new statement's text is trimmed and a blank one is rejected", () => {
  expect(PlannerRuleCreate.parse({ text: "  Two vegetarian dinners a week.  " })).toEqual({ text: "Two vegetarian dinners a week." });
  expect(PlannerRuleCreate.safeParse({ text: "   " }).success).toBe(false);
});

test("an update takes the text, the switch or both, and an id is required", () => {
  expect(PlannerRuleUpdate.parse({ id: "r1", enabled: false })).toEqual({ id: "r1", enabled: false });
  expect(PlannerRuleUpdate.parse({ id: "r1", text: " Vary the week. " })).toEqual({ id: "r1", text: "Vary the week." });
  expect(PlannerRuleUpdate.safeParse({ enabled: true }).success).toBe(false);
});

test("a reorder is a list of ids", () => {
  expect(PlannerRuleReorder.parse({ ids: ["b", "a"] })).toEqual({ ids: ["b", "a"] });
});
