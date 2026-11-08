// Home on a desktop (decisions.md row 207): the day as tiles. The loader's
// data is a fixture; ticking from the shopping tile goes through the real
// rpc's name, mocked here, and the line strikes through at once.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { HomeBento } from "../../../../../src/domain/home/components/desktop/HomeBento";
import type { HomeData } from "../../../../../src/domain/home/home";
import { groupByDay, planEntrySchema } from "../../../../../src/domain/plan/plan";
import type { RecipeSummary } from "../../../../../src/domain/recipes/recipe";
import { noFacets } from "../../../../../src/domain/recipes/recipe";
import { shoppingItemSchema } from "../../../../../src/domain/shopping/shopping";
import { renderInRouter } from "../../../../helpers/dom";
import { atDesktop } from "../../../../helpers/layout";

const tickShoppingItem = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("../../../../../src/api/rpc/shopping", () => ({ tickShoppingItem }));

atDesktop();

const WEDNESDAY = "2026-09-16";
const SATURDAY = "2026-09-19";
const MONDAY = "2026-09-14";
const NEXT_MONDAY = "2026-09-21";

let n = 0;
const uuid = () => `11111111-1111-4111-8111-${String(++n).padStart(12, "0")}`;

function summary(name: string, over: Partial<RecipeSummary> = {}): RecipeSummary {
  return {
    id: uuid(),
    slug: name.toLowerCase().replaceAll(" ", "-"),
    name,
    image: null,
    rating: null,
    prepTime: null,
    performTime: null,
    totalTime: null,
    lastMade: null,
    favourite: false,
    facets: noFacets(),
    tags: [],
    ingredientPreview: [],
    ...over,
  };
}

const ragu = summary("Beef ragu", { totalTime: 230, facets: { ...noFacets(), week: ["weeknight"] }, lastMade: "2026-06-01T00:00:00.000Z" });
const curry = summary("Chickpea curry", { facets: { ...noFacets(), week: ["weeknight"] } });
const tart = summary("Lemon tart");

function entry(date: string, over: Record<string, unknown>) {
  return planEntrySchema.parse({ id: uuid(), date, position: 0, ...over });
}

function line(text: string, ticked = false) {
  return shoppingItemSchema.parse({ id: uuid(), position: n, text, ticked, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" });
}

function data(over: Partial<HomeData> = {}): HomeData {
  const items = [line("Milk"), line("Eggs"), line("Bread", true)];
  return {
    today: WEDNESDAY,
    monday: MONDAY,
    days: groupByDay(MONDAY, [
      entry("2026-09-14", { text: "Leftovers" }),
      entry(WEDNESDAY, { recipe: { id: ragu.id, slug: ragu.slug, name: ragu.name, image: null }, text: ragu.name, servings: 6 }),
    ]),
    nextDays: groupByDay(NEXT_MONDAY, [entry("2026-09-22", { recipe: { id: curry.id, slug: curry.slug, name: curry.name, image: null }, text: curry.name })]),
    toBuy: 2,
    items,
    recipes: [tart, curry, ragu],
    ...over,
  };
}

test("the page is the day's tiles: the week, tonight, the list, next week, the regulars, to try and the newest", async () => {
  await renderInRouter(<HomeBento {...data()} />);

  expect(screen.getByRole("heading", { level: 1, name: "Wednesday" })).toBeInTheDocument();
  expect(screen.getByText("16 September · 2 of 7 nights planned · 2 things to buy")).toBeInTheDocument();

  // The week: seven cards, today marked, a note as it was written, an empty day into the plan.
  const week = screen.getByRole("region", { name: "This week" });
  expect(within(week).getAllByRole("listitem")).toHaveLength(7);
  expect(within(week).getByRole("listitem", { current: "date" })).toHaveTextContent("Beef ragu");
  expect(within(week).getByText("Leftovers")).toBeInTheDocument();
  expect(within(week).getAllByRole("link", { name: /\+ Plan a meal/ })[0]).toHaveAttribute("href", "/plan");

  // Tonight: the name, its time and servings, Cook at the entry's servings, and the recipe in the side panel.
  const tonight = screen.getByRole("region", { name: "Tonight" });
  expect(within(tonight).getByText("3 hr 50 min · serves 6")).toBeInTheDocument();
  expect(within(tonight).getByRole("link", { name: "Cook" })).toHaveAttribute("href", "/recipes/beef-ragu?servings=6&cooking=true");
  expect(within(tonight).getByRole("link", { name: "Open the recipe" })).toHaveAttribute("data-opens", "panel");

  const shopping = screen.getByRole("region", { name: "2 to buy" });
  expect(within(shopping).getByRole("img", { name: "1 of 3 ticked" })).toBeInTheDocument();
  expect(
    within(shopping)
      .getAllByRole("checkbox")
      .map((box) => box.getAttribute("aria-label"))
  ).toEqual(["Milk", "Eggs"]);

  // Through the week, next week is its slots, not the call to plan it.
  const next = screen.getByRole("region", { name: /Next week/ });
  expect(within(next).getByText("Chickpea curry")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Plan next week" })).toBeNull();

  const aWhile = screen.getByRole("region", { name: "Haven't made in a while" });
  expect(
    within(aWhile)
      .getAllByRole("link")
      .map((link) => link.textContent)
  ).toEqual(["Chickpea curryNot made yet", "Beef ragu3 months ago"]);

  const toTry = screen.getByRole("region", { name: "To try" });
  expect(
    within(toTry)
      .getAllByRole("link")
      .map((link) => link.textContent)
  ).toEqual(["Lemon tart", "Chickpea curry"]);

  const recent = screen.getByRole("region", { name: "Recently added" });
  expect(
    within(recent)
      .getAllByRole("link")
      .map((link) => link.textContent)
  ).toEqual(["Lemon tart", "Chickpea curry", "Beef ragu", "Import a recipe"]);
});

test("ticking a line from the shopping tile saves it and reloads the page behind it", async () => {
  const user = userEvent.setup();
  const { router } = await renderInRouter(<HomeBento {...data()} />);
  const invalidate = vi.spyOn(router, "invalidate").mockResolvedValue();

  const milk = screen.getByRole("checkbox", { name: "Milk" });
  await user.click(milk);

  expect(tickShoppingItem).toHaveBeenCalledWith({ data: { id: expect.any(String), ticked: true } });
  await waitFor(() => expect(invalidate).toHaveBeenCalled());
});

test("a tick that cannot be saved puts the box back", async () => {
  const user = userEvent.setup();
  tickShoppingItem.mockRejectedValueOnce(new Error("offline"));
  await renderInRouter(<HomeBento {...data()} />);

  const eggs = screen.getByRole("checkbox", { name: "Eggs" });
  await user.click(eggs);
  await waitFor(() => expect(eggs).toHaveAttribute("aria-checked", "false"));
});

test("at the weekend with next week empty, a brand tile asks to plan it in place of the slots", async () => {
  await renderInRouter(<HomeBento {...data({ today: SATURDAY, nextDays: groupByDay(NEXT_MONDAY, []) })} />);
  expect(screen.getByRole("link", { name: "Plan next week" })).toHaveAttribute("href", `/plan/fill?week=${NEXT_MONDAY}`);
  expect(screen.queryByRole("region", { name: /Next week ·/ })).toBeNull();
});

test("nothing tonight offers the plan; an unreadable list and nothing to try still draw the page", async () => {
  await renderInRouter(<HomeBento {...data({ days: groupByDay(MONDAY, []), items: null, toBuy: null, recipes: [] })} />);
  expect(screen.getByText("Nothing planned for tonight.")).toBeInTheDocument();
  expect(screen.getByText("The list couldn't be read just now.")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "To try" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Haven't made in a while" })).toBeNull();
  expect(screen.getByText("16 September · 0 of 7 nights planned")).toBeInTheDocument();
});
