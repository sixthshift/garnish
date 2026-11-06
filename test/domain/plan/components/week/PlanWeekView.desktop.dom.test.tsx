// The plan on a desktop (decisions.md row 206): the week beside its picker. A
// day's "+" chooses the day the picker adds to rather than opening a sheet,
// and each add keeps that day, so the next follows at once.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { PlanWeekView } from "../../../../../src/domain/plan/components/week/PlanWeekView";
import { groupByDay } from "../../../../../src/domain/plan/plan";
import type { RecipeSummary } from "../../../../../src/domain/recipes/recipe";
import { renderInRouter } from "../../../../helpers/dom";
import { atDesktop } from "../../../../helpers/layout";

atDesktop();

const MONDAY = "2026-09-14";
const tart = { id: "11111111-1111-4111-8111-111111111111", slug: "lemon-tart", name: "Lemon tart", image: null } as RecipeSummary;
const noop = () => {};

async function week(today = "2026-09-16") {
  const spies = { onAddRecipe: vi.fn(), onAddText: vi.fn() };
  await renderInRouter(
    <PlanWeekView monday={MONDAY} days={groupByDay(MONDAY, [])} today={today} searchRecipes={async () => [tart]} onMove={noop} onRemove={noop} {...spies} />
  );
  return spies;
}

test("the picker sits beside the week, adding to today, and does not take focus as the page opens", async () => {
  await week();
  expect(screen.getByRole("heading", { name: "Adding to Wednesday 16 September" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add to Wednesday 16 September" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Add to Monday 14 September" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("combobox", { name: "Search recipes, or type a note" })).not.toHaveFocus();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("another week's picker starts on its Monday", async () => {
  await week("2026-09-30");
  expect(screen.getByRole("heading", { name: "Adding to Monday 14 September" })).toBeInTheDocument();
});

test("a day's + chooses it, the box takes focus, and adds keep landing on it with no sheet", async () => {
  const user = userEvent.setup();
  const { onAddRecipe, onAddText } = await week();

  await user.click(screen.getByRole("button", { name: "Add to Tuesday 15 September" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("heading", { name: "Adding to Tuesday 15 September" })).toBeInTheDocument();
  const box = screen.getByRole("combobox", { name: "Search recipes, or type a note" });
  await waitFor(() => expect(box).toHaveFocus());

  await user.type(box, "lem");
  await user.click(await screen.findByRole("option", { name: /Lemon tart/ }));
  expect(onAddRecipe).toHaveBeenCalledWith("2026-09-15", tart, null);

  await user.type(box, "Leftovers{Enter}");
  expect(onAddText).toHaveBeenCalledWith("2026-09-15", "Leftovers", null);
  expect(screen.getByRole("heading", { name: "Adding to Tuesday 15 September" })).toBeInTheDocument();
});
