// Home on a phone (decisions.md row 208): tonight filling the screen, the
// week as a strip, the shopping card, to try as circles and the regulars not
// made in a while. The loader's data is a fixture and the plan's writes are
// spies; the add sheet is the plan's own, opened from an empty day, Plan
// tonight and Swap.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { PhoneHome, type PhoneHomeActions } from "../../../../../src/domain/home/components/mobile/PhoneHome";
import type { HomeData } from "../../../../../src/domain/home/home";
import { groupByDay, planEntrySchema } from "../../../../../src/domain/plan/plan";
import type { RecipeSummary } from "../../../../../src/domain/recipes/recipe";
import { noFacets } from "../../../../../src/domain/recipes/recipe";
import { shoppingItemSchema } from "../../../../../src/domain/shopping/shopping";
import { renderInRouter } from "../../../../helpers/dom";

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

const ragu = summary("Beef ragu", { image: "ragu.jpg", totalTime: 230, facets: { ...noFacets(), week: ["weeknight"] }, lastMade: "2026-06-01T00:00:00.000Z" });
const curry = summary("Chickpea curry", { facets: { ...noFacets(), week: ["weeknight"] }, lastMade: "2026-08-01T00:00:00.000Z" });
const tart = summary("Lemon tart");

function entry(date: string, over: Record<string, unknown>) {
  return planEntrySchema.parse({ id: uuid(), date, position: 0, ...over });
}

function line(text: string, ticked = false) {
  return shoppingItemSchema.parse({ id: uuid(), position: n, text, ticked, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" });
}

const tonight = entry(WEDNESDAY, {
  recipe: { id: ragu.id, slug: ragu.slug, name: ragu.name, image: ragu.image },
  text: ragu.name,
  servings: 6,
  meal: "dinner",
});

function data(over: Partial<HomeData> = {}): HomeData {
  return {
    today: WEDNESDAY,
    monday: MONDAY,
    days: groupByDay(MONDAY, [entry(MONDAY, { text: "Leftovers" }), tonight]),
    nextDays: groupByDay(NEXT_MONDAY, [entry("2026-09-22", { recipe: { id: curry.id, slug: curry.slug, name: curry.name, image: null }, text: curry.name })]),
    toBuy: 2,
    items: [line("Milk"), line("Eggs"), line("Bread", true)],
    recipes: [tart, curry, ragu],
    ...over,
  };
}

async function renderHome(over: Partial<HomeData> = {}) {
  const actions = { busy: false, searchRecipes: vi.fn(async () => [tart]), onAdd: vi.fn(), onSwap: vi.fn() } satisfies PhoneHomeActions;
  const result = await renderInRouter(<PhoneHome {...data(over)} {...actions} />);
  return { ...result, ...actions };
}

test("the day heads the page, with Settings as a gear beside it", async () => {
  await renderHome();
  expect(screen.getByRole("heading", { level: 1, name: "Wednesday" })).toBeInTheDocument();
  expect(screen.getByText("16 September")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
});

test("tonight fills the card over its photo: the name, the meal, the time, and Cook, Recipe and Swap", async () => {
  await renderHome();
  const hero = screen.getByRole("region", { name: "Tonight" });
  expect(hero.querySelector('img[src="/api/images/ragu.jpg"]')).not.toBeNull();
  expect(within(hero).getByText("Beef ragu")).toBeInTheDocument();
  expect(within(hero).getByText("Dinner · 3 hr 50 min · serves 6")).toBeInTheDocument();
  expect(within(hero).getByRole("link", { name: "Cook" })).toHaveAttribute("href", "/recipes/beef-ragu?servings=6&cooking=true");
  expect(within(hero).getByRole("link", { name: "Recipe" })).toHaveAttribute("href", "/recipes/beef-ragu?servings=6");
  expect(within(hero).getByRole("button", { name: "Swap" })).toBeInTheDocument();
});

test("Swap opens today's add sheet, and what is chosen takes tonight's place at its meal", async () => {
  const user = userEvent.setup();
  const { onSwap, onAdd } = await renderHome();
  await user.click(screen.getByRole("button", { name: "Swap" }));

  const sheet = await screen.findByRole("dialog", { name: "Adding to Wednesday 16 September" });
  await user.type(within(sheet).getByRole("combobox"), "Pizza night");
  await user.click(within(sheet).getByRole("button", { name: "Add “Pizza night” as a note" }));

  expect(onSwap).toHaveBeenCalledWith(tonight, { text: "Pizza night" }, "dinner");
  expect(onAdd).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("the week is a strip of seven cards: today marked, a day gone by and a note as they are, an empty day to come a +", async () => {
  await renderHome();
  const week = screen.getByRole("region", { name: "This week" });
  const cards = within(week).getAllByRole("listitem");
  expect(cards).toHaveLength(7);
  expect(cards[2]).toHaveAttribute("aria-current", "date");
  expect(within(cards[2] as HTMLElement).getByRole("link", { name: /Beef ragu/ })).toHaveAttribute("href", "/recipes/beef-ragu?servings=6");
  expect(within(cards[0] as HTMLElement).getByText("Leftovers")).toBeInTheDocument();
  // Tuesday is past and empty: nothing to press.
  expect(within(cards[1] as HTMLElement).queryByRole("button")).toBeNull();
  expect(within(cards[3] as HTMLElement).getByRole("button", { name: "Plan Thursday 17 September" })).toBeInTheDocument();
  expect(within(week).getByRole("link", { name: "Open the plan" })).toHaveAttribute("href", "/plan");
});

test("an empty day's + opens the add sheet for that day, and a recipe picked there goes on it", async () => {
  const user = userEvent.setup();
  const { onAdd, onSwap } = await renderHome();
  await user.click(screen.getByRole("button", { name: "Plan Friday 18 September" }));

  const sheet = await screen.findByRole("dialog", { name: "Adding to Friday 18 September" });
  await user.type(within(sheet).getByRole("combobox"), "tart");
  await user.click(await within(sheet).findByRole("option", { name: /Lemon tart/ }));

  expect(onAdd).toHaveBeenCalledWith("2026-09-18", { recipe: tart }, null);
  expect(onSwap).not.toHaveBeenCalled();
});

test("the shopping card rings what is in the trolley, says what is left, and starts the list", async () => {
  await renderHome();
  const card = screen.getByRole("region", { name: "2 to buy" });
  expect(within(card).getByRole("img", { name: "1 of 3 ticked" })).toBeInTheDocument();
  expect(within(card).getByText("1 already in the trolley")).toBeInTheDocument();
  expect(within(card).getByRole("link", { name: "Start" })).toHaveAttribute("href", "/shopping");
});

test("to try is a row of circles, and the regulars not made in a while say how long", async () => {
  await renderHome();
  const tries = screen.getByRole("region", { name: "To try" });
  expect(within(tries).getByRole("link", { name: "Lemon tart" })).toHaveAttribute("href", "/recipes/lemon-tart");

  const regulars = within(screen.getByRole("region", { name: "Haven't made in a while" })).getAllByRole("link");
  expect(regulars.map((link) => link.textContent)).toEqual(["Beef ragu3 months ago", "Chickpea curry6 weeks ago"]);
});

test("nothing planned tonight says so and offers to plan it; an unread list and empty lists draw what they can", async () => {
  const user = userEvent.setup();
  const { onAdd } = await renderHome({
    days: groupByDay(MONDAY, []),
    items: null,
    toBuy: null,
    recipes: [summary("Toast", { lastMade: "2026-09-15T00:00:00.000Z" })],
  });
  const hero = screen.getByRole("region", { name: "Tonight" });
  expect(within(hero).getByText("Nothing planned for tonight.")).toBeInTheDocument();
  expect(within(hero).getByRole("link", { name: "Open the plan" })).toHaveAttribute("href", "/plan");

  expect(screen.getByText("The list couldn't be read just now.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open the list" })).toHaveAttribute("href", "/shopping");
  expect(screen.queryByRole("region", { name: "To try" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Haven't made in a while" })).toBeNull();

  await user.click(within(hero).getByRole("button", { name: "Plan tonight" }));
  const sheet = await screen.findByRole("dialog", { name: "Adding to Wednesday 16 September" });
  await user.type(within(sheet).getByRole("combobox"), "Out");
  await user.click(within(sheet).getByRole("button", { name: "Add “Out” as a note" }));
  expect(onAdd).toHaveBeenCalledWith(WEDNESDAY, { text: "Out" }, null);
});

test("at the weekend an empty next week is the brand card; through the week it is a quiet line", async () => {
  await renderHome({ today: SATURDAY, nextDays: groupByDay(NEXT_MONDAY, []) });
  const prompt = screen.getByRole("region", { name: "Next week isn't planned yet" });
  expect(within(prompt).getByRole("link", { name: "Plan next week" })).toHaveAttribute("href", `/plan/fill?week=${NEXT_MONDAY}`);
});

test("through the week, next week is a line saying how much is planned", async () => {
  await renderHome();
  expect(screen.queryByRole("region", { name: "Next week isn't planned yet" })).toBeNull();
  const next = screen.getByRole("region", { name: /Next week/ });
  expect(within(next).getByText("1 meal planned")).toBeInTheDocument();
  expect(within(next).getByRole("link", { name: "Open" })).toHaveAttribute("href", `/plan?week=${NEXT_MONDAY}`);
});
