// Plan the week with a model (decisions.md row 194): the page asks the planner
// as it opens, shows its picks and reasons where the rotation's would be, and
// writes what is accepted through applyPlanProposal. The server functions are
// stand-ins, so the model's answer is fixed.

import { RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { RecipeSummary } from "../../../../src/domain/recipe";
import { testRouter } from "../../../helpers/routes";

const MONDAY = "2026-11-02";

function summary(id: string, name: string, kind: RecipeSummary["kind"]): RecipeSummary {
  return {
    id,
    slug: name.toLowerCase(),
    name,
    image: null,
    rating: null,
    prepTime: null,
    performTime: null,
    totalTime: null,
    lastMade: null,
    favourite: false,
    kind,
    tags: [],
    ingredientPreview: [],
  };
}
const dal = summary("00000000-0000-4000-8000-000000000001", "Dal", "rotation");
const kofta = summary("00000000-0000-4000-8000-000000000002", "Kofta", "rotation");
const lamb = summary("00000000-0000-4000-8000-000000000003", "Lamb", "weekend");

const fns = vi.hoisted(() => ({
  proposePlanWeek: vi.fn(),
  applyPlanProposal: vi.fn(async () => []),
  addPlanWeekToShopping: vi.fn(async () => ({ added: 3 })),
  aiAvailable: vi.fn(async () => ({ available: true })),
}));

vi.mock("../../../../src/server/fns/plan", () => ({
  listPlanWeek: vi.fn(async ({ data }: { data: { monday: string } }) =>
    Array.from({ length: 7 }, (_, i) => {
      const at = new Date(`${data.monday}T00:00:00Z`);
      at.setUTCDate(at.getUTCDate() + i);
      return { date: at.toISOString().slice(0, 10), entries: [] };
    })
  ),
  addPlanWeekToShopping: fns.addPlanWeekToShopping,
}));
const library = vi.hoisted(() => ({ current: [] as RecipeSummary[] }));
vi.mock("../../../../src/server/fns/recipes", () => ({ listRecipes: vi.fn(async () => library.current) }));
vi.mock("../../../../src/server/fns/ai", () => ({ aiAvailable: fns.aiAvailable }));
vi.mock("../../../../src/server/fns/planner", () => ({ proposePlanWeek: fns.proposePlanWeek, applyPlanProposal: fns.applyPlanProposal }));

const entry = (date: string, recipe: RecipeSummary, reason: string) => ({
  date,
  meal: "dinner",
  recipeId: recipe.id,
  reason,
  recipe: { id: recipe.id, slug: recipe.slug, name: recipe.name, image: null },
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-31T10:00:00"));
  fns.proposePlanWeek.mockReset();
  fns.applyPlanProposal.mockClear();
  window.localStorage.clear();
  library.current = [dal, kofta, lamb];
});
afterEach(() => vi.useRealTimers());

async function open() {
  const router = testRouter(`/plan/fill?week=${MONDAY}`);
  await router.load();
  // StrictMode, as the dev server runs it: an effect mounted twice must still ask the model once.
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
  return router;
}

test("the planner's picks and reasons fill the week, and Add writes them at the head count", async () => {
  fns.proposePlanWeek.mockResolvedValue({
    entries: [entry("2026-11-02", kofta, "not had since September"), entry("2026-11-07", lamb, "a slow cook for Saturday")],
    dropped: [],
    unfilled: [],
    taken: [],
  });
  await open();
  await screen.findByText("Chosen by the planner from your guide. Change anything below.");
  expect(fns.proposePlanWeek).toHaveBeenCalledTimes(1);
  expect(fns.proposePlanWeek).toHaveBeenCalledWith({
    data: { monday: MONDAY, dates: ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"], meals: ["dinner"] },
  });
  expect(screen.getByText("not had since September")).toBeInTheDocument();
  // Tuesday, which the planner left open, comes from the rotation.
  expect(screen.getByText("Dal")).toBeInTheDocument();

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("a slow cook for Saturday")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("button", { name: "Add 3 to the plan" }));
  await waitFor(() =>
    expect(fns.applyPlanProposal).toHaveBeenCalledWith({
      data: {
        entries: [
          { date: "2026-11-02", meal: "dinner", recipeId: kofta.id },
          { date: "2026-11-03", meal: "dinner", recipeId: dal.id },
          { date: "2026-11-07", meal: "dinner", recipeId: lamb.id },
        ],
        servings: 4,
      },
    })
  );
});

test("when the planner fails the rotation's week stands, with why", async () => {
  fns.proposePlanWeek.mockRejectedValue(new Error("No AI provider is set."));
  await open();
  await screen.findByText("The planner couldn't answer, so these are from the rotation.");
  expect(screen.getByText("No AI provider is set.")).toBeInTheDocument();
  expect(screen.getByText("Dal")).toBeInTheDocument();
  expect(screen.getByText("Kofta")).toBeInTheDocument();
});

test("while the planner chooses the days wait in place; with nothing marked Rotation its picks can still be swapped", async () => {
  const plain = [summary("00000000-0000-4000-8000-000000000011", "Soup", null), summary("00000000-0000-4000-8000-000000000012", "Pie", null)];
  library.current = plain;
  let answer: (value: unknown) => void = () => {};
  fns.proposePlanWeek.mockReturnValue(new Promise((resolve) => (answer = resolve)));
  await open();
  expect(await screen.findAllByText("Choosing…")).toHaveLength(5);
  expect(screen.getByRole("button", { name: "Swap Mon" })).toBeDisabled();
  answer({ entries: [entry("2026-11-02", plain[0]!, "a soup for Monday")], dropped: [], unfilled: [], taken: [] });
  await screen.findByText("a soup for Monday");
  expect(screen.queryByText(/No recipes are marked Rotation yet/)).toBeNull();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Swap Mon" }));
  expect(screen.getAllByText("Pie").length).toBeGreaterThan(0);
});
