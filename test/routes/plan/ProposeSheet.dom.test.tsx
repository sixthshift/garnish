// The proposal sheet, pressed rather than read (M39.5, M39.7). The node suite
// asserts what the two stages draw; only a DOM can untick a day, tick a meal,
// press Propose and see what went to the server. The server functions are mocked: a test that
// asks a model is not a test.
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ProposeSheet } from "../../../src/routes/plan/components/ProposeSheet";
import { PLANNER_DAYS_KEY, PLANNER_MEALS_KEY } from "../../../src/routes/plan/components/proposalSheet";
import { applyPlanProposal, proposePlanWeek } from "../../../src/server/fns/planner";
import { renderInRouter } from "../../helpers/dom";

const MONDAY = "2026-09-14";
const TODAY = "2026-09-14"; // the Monday itself, so no day is in the past

const ragu = { id: "11111111-1111-4111-8111-111111111111", slug: "beef-ragu", name: "Beef ragu", image: null };

vi.mock("../../../src/server/fns/planner", () => ({
  proposePlanWeek: vi.fn(async () => ({
    entries: [{ date: "2026-09-16", meal: "dinner", recipeId: ragu.id, reason: "Nothing slow-cooked lately.", recipe: ragu }],
    dropped: [],
    unfilled: [],
    taken: [],
  })),
  applyPlanProposal: vi.fn(async () => []),
}));

/** A `Storage`-shaped map, so the sheet's memory is the test's. */
function memory(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value), map };
}

test("unticking a day leaves it out of the run, remembers it, and the answer's rows can be added", async () => {
  vi.mocked(proposePlanWeek).mockClear();
  vi.mocked(applyPlanProposal).mockClear();
  const user = userEvent.setup();
  const storage = memory();
  await renderInRouter(<ProposeSheet open monday={MONDAY} today={TODAY} storage={storage} onClose={() => {}} />);

  await user.click(screen.getByRole("checkbox", { name: "Wed 16 Sep" }));
  expect(storage.map.get(PLANNER_DAYS_KEY)).toBe("[0,1,3,4,5,6]");

  await user.click(screen.getByTestId("propose-run"));
  expect(proposePlanWeek).toHaveBeenCalledWith({
    data: { monday: MONDAY, dates: ["2026-09-14", "2026-09-15", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"], meals: ["dinner"] },
  });

  // The answer is on screen, ticked, and nothing has been written yet.
  expect(await screen.findByText("Beef ragu")).toBeTruthy();
  expect(screen.getByText("Nothing slow-cooked lately.")).toBeTruthy();
  expect(applyPlanProposal).not.toHaveBeenCalled();

  await user.click(screen.getByTestId("propose-add"));
  expect(applyPlanProposal).toHaveBeenCalledWith({ data: { entries: [{ date: "2026-09-16", meal: "dinner", recipeId: ragu.id }] } });
});

test("unticking a proposed row leaves it out of what Add sends", async () => {
  vi.mocked(applyPlanProposal).mockClear();
  const user = userEvent.setup();
  await renderInRouter(<ProposeSheet open monday={MONDAY} today={TODAY} storage={memory()} onClose={() => {}} />);

  await user.click(screen.getByTestId("propose-run"));
  await user.click(await screen.findByRole("checkbox", { name: "Dinner: Beef ragu" }));
  await user.click(screen.getByTestId("propose-add"));

  expect(applyPlanProposal).not.toHaveBeenCalled(); // nothing ticked: the button is disabled
});

test("ticking a meal remembers it and carries it to the run; unticking them all disables Propose", async () => {
  vi.mocked(proposePlanWeek).mockClear();
  const user = userEvent.setup();
  const storage = memory();
  await renderInRouter(<ProposeSheet open monday={MONDAY} today={TODAY} storage={storage} onClose={() => {}} />);

  await user.click(screen.getByRole("checkbox", { name: "Breakfast" }));
  expect(storage.map.get(PLANNER_MEALS_KEY)).toBe('["breakfast","dinner"]');

  await user.click(screen.getByTestId("propose-run"));
  expect(vi.mocked(proposePlanWeek).mock.calls[0]![0]!.data.meals).toEqual(["breakfast", "dinner"]);
});

test("with no meal ticked Propose cannot run", async () => {
  vi.mocked(proposePlanWeek).mockClear();
  const user = userEvent.setup();
  await renderInRouter(<ProposeSheet open monday={MONDAY} today={TODAY} storage={memory()} onClose={() => {}} />);

  await user.click(screen.getByRole("checkbox", { name: "Dinner" }));
  await user.click(screen.getByTestId("propose-run"));
  expect(proposePlanWeek).not.toHaveBeenCalled();
});
