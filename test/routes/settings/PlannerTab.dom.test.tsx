// The Planner tab's meal switches, pressed rather than read (M39.2). The node
// suite asserts the three checkboxes are drawn with the right one ticked; only
// a DOM can press one and see what is written.
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { PlannerMeal } from "../../../src/domain/planner";
import { PlannerTab } from "../../../src/routes/settings/components/tabs/PlannerTab";
import { setPlannerMeals } from "../../../src/server/fns/planner";
import { renderInRouter } from "../../helpers/dom";

// The writes go to the server; what this file is about is which one is called with what.
vi.mock("../../../src/server/fns/planner", () => ({
  createPlannerRule: vi.fn(async () => ({})),
  deletePlannerRule: vi.fn(async () => ({})),
  reorderPlannerRules: vi.fn(async () => []),
  updatePlannerRule: vi.fn(async () => ({})),
  setPlannerMeals: vi.fn(async () => []),
  listPlannerMeals: vi.fn(async () => []),
  listPlannerRules: vi.fn(async () => []),
}));

const MEALS: PlannerMeal[] = [
  { meal: "breakfast", enabled: false },
  { meal: "lunch", enabled: false },
  { meal: "dinner", enabled: true },
];

async function renderTab() {
  vi.mocked(setPlannerMeals).mockClear();
  await renderInRouter(<PlannerTab rules={[]} meals={MEALS} />);
}

test("ticking a meal writes that one meal on, and nothing else", async () => {
  const user = userEvent.setup();
  await renderTab();

  await user.click(screen.getByRole("checkbox", { name: "Lunch" }));
  expect(setPlannerMeals).toHaveBeenCalledWith({ data: { meals: [{ meal: "lunch", enabled: true }] } });
  expect(setPlannerMeals).toHaveBeenCalledTimes(1);
});

test("unticking the meal that is on writes it off", async () => {
  const user = userEvent.setup();
  await renderTab();

  await user.click(screen.getByRole("checkbox", { name: "Dinner" }));
  expect(setPlannerMeals).toHaveBeenCalledWith({ data: { meals: [{ meal: "dinner", enabled: false }] } });
});
