// The plan on a desktop as a board (decisions.md row 207): the chosen week and
// the next, a shelf beside them that adds to the chosen day, a day's target
// that chooses it, and drags from the shelf onto a day and between days.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { PlanWeekView, type PlanWeekViewProps } from "../../../../../src/domain/plan/components/week/PlanWeekView";
import { groupByDay, type PlanEntry, planEntrySchema } from "../../../../../src/domain/plan/plan";
import type { RecipeSummary } from "../../../../../src/domain/recipes/recipe";
import { renderInRouter } from "../../../../helpers/dom";
import { atDesktop } from "../../../../helpers/layout";

atDesktop();

const MONDAY = "2026-09-14";
const NEXT = "2026-09-21";
const recipe = (over: Partial<RecipeSummary>): RecipeSummary =>
  ({ image: null, totalTime: null, lastMade: null, kind: null, tags: [], ingredientPreview: [], favourite: false, rating: null, ...over }) as RecipeSummary;
const tart = recipe({ id: "11111111-1111-4111-8111-111111111111", slug: "lemon-tart", name: "Lemon tart", totalTime: 100 });
const dal = recipe({
  id: "22222222-2222-4222-8222-222222222222",
  slug: "dal",
  name: "Red lentil dal",
  kind: "rotation",
  lastMade: "2026-08-31T09:00:00.000Z",
  totalTime: 40,
});
const roast = recipe({
  id: "33333333-3333-4333-8333-333333333333",
  slug: "roast",
  name: "Slow roast lamb",
  kind: "weekend",
  lastMade: "2026-06-01T09:00:00.000Z",
});

const soup: PlanEntry = planEntrySchema.parse({
  id: "99999999-9999-4999-8999-000000000001",
  date: "2026-09-15",
  position: 0,
  recipe: { id: "44444444-4444-4444-8444-444444444444", slug: "soup", name: "Pea soup", image: null },
  text: "Pea soup",
});

async function board(today = "2026-09-16", over: Partial<PlanWeekViewProps> = {}) {
  const spies = { onAddRecipe: vi.fn(), onAddText: vi.fn(), onMove: vi.fn(), onRemove: vi.fn() };
  await renderInRouter(
    <PlanWeekView
      monday={MONDAY}
      days={groupByDay(MONDAY, [soup])}
      nextDays={groupByDay(NEXT, [])}
      today={today}
      searchRecipes={async () => [tart]}
      shelfRecipes={async () => [tart, dal, roast]}
      {...spies}
      {...over}
    />
  );
  return spies;
}

const week = (name: string) => screen.getByRole("region", { name });
const day = (date: string) => document.querySelector(`[data-testid="plan-day"][data-date="${date}"]`) as HTMLElement;

test("the board shows this week and the next, fourteen days, with how many nights each has", async () => {
  await board();
  expect(screen.getByRole("heading", { level: 2, name: "This week" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: "Next week" })).toBeInTheDocument();
  expect(within(week("This week")).getAllByTestId("plan-day")).toHaveLength(7);
  expect(within(week("Next week")).getAllByTestId("plan-day")).toHaveLength(7);
  expect(week("This week")).toHaveTextContent("1 of 7 nights");
  expect(week("Next week")).toHaveTextContent("0 of 7 nights");
  expect(screen.getByTestId("plan-week-label")).toHaveTextContent("14 – 27 Sep 2026");
  expect(day("2026-09-16")).toHaveAttribute("aria-current", "date");
  // Each week keeps its own actions.
  expect(within(week("Next week")).getByRole("link", { name: "Plan the week" })).toHaveAttribute("href", `/plan/fill?week=${NEXT}`);
  expect(within(week("Next week")).getByRole("button", { name: "Add to shopping" })).toBeInTheDocument();
});

test("the shelf adds to today to begin with, without taking focus, and lists the rotation", async () => {
  await board();
  expect(screen.getByRole("heading", { name: "Adding to Wednesday 16 September" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add to Wednesday 16 September" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("combobox", { name: "Search recipes, or type a note" })).not.toHaveFocus();
  const rotation = await screen.findByRole("list", { name: "Rotation recipes" });
  expect(
    within(rotation)
      .getAllByRole("button")
      .map((button) => button.textContent)
  ).toEqual([expect.stringContaining("Red lentil dal")]);
  expect(rotation).toHaveTextContent("40 min · made 2 weeks ago");
});

test("a board two weeks away starts the shelf on its first Monday", async () => {
  await board("2026-10-07");
  expect(screen.getByRole("heading", { name: "Adding to Monday 14 September" })).toBeInTheDocument();
});

test("a day's target chooses it, even next week's, and a shelf card clicked goes on it", async () => {
  const user = userEvent.setup();
  const { onAddRecipe } = await board();

  await user.click(screen.getByRole("button", { name: "Add to Tuesday 22 September" }));
  expect(screen.getByRole("heading", { name: "Adding to Tuesday 22 September" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add to Tuesday 22 September" })).toHaveAttribute("aria-pressed", "true");
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Search recipes, or type a note" })).toHaveFocus());

  await user.click(screen.getByRole("tab", { name: "Weekend" }));
  await user.click(await screen.findByRole("button", { name: "Add Slow roast lamb to Tuesday 22 September" }));
  expect(onAddRecipe).toHaveBeenCalledWith("2026-09-22", roast, null);
});

test("the meal chip pressed goes with a shelf card clicked", async () => {
  const user = userEvent.setup();
  const { onAddRecipe } = await board();
  await user.click(screen.getByRole("button", { name: "Dinner" }));
  await user.click(screen.getByRole("tab", { name: "To try" }));
  await user.click(await screen.findByRole("button", { name: "Add Lemon tart to Wednesday 16 September" }));
  expect(onAddRecipe).toHaveBeenCalledWith("2026-09-16", tart, "dinner");
});

test("the search still adds a recipe or a plain note to the chosen day, and stands in for the tabs while typed", async () => {
  const user = userEvent.setup();
  const { onAddRecipe, onAddText } = await board();
  await user.click(screen.getByRole("button", { name: "Add to Friday 18 September" }));
  const box = screen.getByRole("combobox", { name: "Search recipes, or type a note" });

  await user.type(box, "lem");
  expect(screen.queryByRole("tab", { name: "Rotation" })).toBeNull();
  await user.click(await screen.findByRole("option", { name: /Lemon tart/ }));
  expect(onAddRecipe).toHaveBeenCalledWith("2026-09-18", tart, null);
  expect(await screen.findByRole("tab", { name: "Rotation" })).toBeInTheDocument();

  await user.type(box, "Out{Enter}");
  expect(onAddText).toHaveBeenCalledWith("2026-09-18", "Out", null);
});

test("a shelf card dragged onto a day goes on that day, whichever is chosen", async () => {
  const { onAddRecipe } = await board();
  fireEvent.dragStart(await screen.findByRole("button", { name: "Add Red lentil dal to Wednesday 16 September" }));
  const target = day("2026-09-24");
  fireEvent.dragEnter(target);
  expect(target).toHaveAttribute("data-over", "true");
  fireEvent.dragOver(target);
  fireEvent.drop(target);
  expect(onAddRecipe).toHaveBeenCalledWith("2026-09-24", dal, null);
  expect(target).not.toHaveAttribute("data-over");
});

test("an entry dragged to another day moves to its end, and a drop on itself moves nothing", async () => {
  const { onMove } = await board();
  const entry = within(day("2026-09-15")).getByTestId("plan-entry");

  fireEvent.dragStart(entry);
  fireEvent.drop(entry);
  expect(onMove).not.toHaveBeenCalled();

  fireEvent.dragStart(entry);
  fireEvent.drop(day("2026-09-21"));
  expect(onMove).toHaveBeenCalledWith(soup, "2026-09-21", 0);
});

test("an entry still opens in the side panel, and its menu moves it to a day of either week", async () => {
  const user = userEvent.setup();
  const { onMove } = await board();
  expect(screen.getByRole("link", { name: /Pea soup/ })).toHaveAttribute("data-opens", "panel");
  await user.click(screen.getByRole("button", { name: "Actions for Pea soup" }));
  await user.click(screen.getByRole("menuitem", { name: "Move to Thu 24 Sep" }));
  expect(onMove).toHaveBeenCalledWith(soup, "2026-09-24", 0);
});
