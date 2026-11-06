// A phone's tab bar and its + (decisions.md row 208): Home, Plan, the +,
// Shopping and Recipes; the + opens the command sheet, which plans a recipe
// on a day, adds a line to the shopping list or opens a recipe, then closes
// with a toast, through the same rpc as a desktop's command bar.
import { toastStore } from "@sixthshift/design-system/overlay";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { MobileLayout } from "../../../src/app/mobile/components/MobileLayout";
import { addDays, dayName, dayParts, type PlanDay, todayIso } from "../../../src/domain/plan/plan";

const ragu = { id: "00000000-0000-4000-8000-000000000001", slug: "beef-ragu", name: "Beef Ragu", image: null };
const rice = { id: "00000000-0000-4000-8000-000000000002", slug: "fried-rice", name: "Fried Rice", image: null };

const rpc = vi.hoisted(() => ({
  listRecipes: vi.fn(),
  listPlanWeek: vi.fn(),
  addPlanEntry: vi.fn(),
  addShoppingItems: vi.fn(),
}));
vi.mock("../../../src/api/rpc/recipes", () => ({ listRecipes: rpc.listRecipes }));
vi.mock("../../../src/api/rpc/plan", () => ({ listPlanWeek: rpc.listPlanWeek, addPlanEntry: rpc.addPlanEntry }));
vi.mock("../../../src/api/rpc/shopping", () => ({ addShoppingItems: rpc.addShoppingItems }));

const today = todayIso();
rpc.listRecipes.mockImplementation(async ({ data }: { data: { q: string } }) => [ragu, rice].filter((r) => r.name.toLowerCase().includes(data.q)));
// Beef Ragu is on tomorrow, whichever week asks: the examples are made from it.
rpc.listPlanWeek.mockImplementation(async (): Promise<PlanDay[]> => [{ date: addDays(today, 1), entries: [{ recipe: ragu }] } as unknown as PlanDay]);
rpc.addPlanEntry.mockImplementation(async () => ({}));
rpc.addShoppingItems.mockImplementation(async () => []);

afterEach(() => {
  for (const record of toastStore.snapshot()) toastStore.remove(record.id);
  vi.clearAllMocks();
});

/** A phone's layout over a home page and a recipe page, at `/`. */
async function app() {
  const root = createRootRoute({ component: () => <MobileLayout hideNav={false} /> });
  const home = createRoute({ getParentRoute: () => root, path: "/", component: () => <h1>Home</h1> });
  const recipe = createRoute({ getParentRoute: () => root, path: "recipes/$slug", component: () => <h1>A recipe</h1> });
  const anywhere = createRoute({ getParentRoute: () => root, path: "$", component: () => <h1>Elsewhere</h1> });
  const router = createRouter({ routeTree: root.addChildren([home, recipe, anywhere]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  const invalidate = vi.spyOn(router, "invalidate");
  await router.load();
  render(<RouterProvider router={router as never} />);
  await screen.findByRole("heading", { name: "Home" });
  return { router, invalidate };
}

async function openSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Plan, add or find" }));
  return screen.findByRole("dialog", { name: "Plan, add or find" });
}

test("the tab bar is Home, Plan, the +, Shopping and Recipes, with Home marked", async () => {
  await app();
  const bar = screen.getByRole("navigation", { name: "Main" });
  const slots = [...bar.querySelectorAll("a, button")].map((slot) => slot.getAttribute("aria-label") ?? slot.textContent);
  expect(slots).toEqual(["Home", "Plan", "Plan, add or find", "Shopping", "Recipes"]);
  expect(within(bar).queryByRole("link", { name: "Settings" })).toBeNull();
  expect(within(bar).getByRole("link", { current: "page" })).toHaveTextContent("Home");
});

test("the + opens the sheet with its box focused and examples from the plan", async () => {
  const user = userEvent.setup();
  await app();
  expect(screen.queryByRole("dialog")).toBeNull();
  await openSheet(user);
  const box = screen.getByRole("combobox", { name: "Search, plan or add" });
  await waitFor(() => expect(box).toHaveFocus());
  // The empty sheet offers next week and the places, Settings among them now the bar has none.
  expect(screen.getByRole("option", { name: /Plan next week/ })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /Settings/ })).toBeInTheDocument();
  const tomorrow = dayParts(addDays(today, 1)).weekday.toLowerCase();
  const examples = within(screen.getByRole("group", { name: "Examples" })).getAllByRole("button");
  expect(examples.map((chip) => chip.textContent)).toEqual([`ragu ${tomorrow}`, "milk", "settings"]);
});

test("an example fills the box, and Enter puts the recipe on that day with a toast", async () => {
  const user = userEvent.setup();
  const { invalidate } = await app();
  await openSheet(user);
  const chip = await screen.findByRole("button", { name: /^ragu / });
  await user.click(chip);
  const box = screen.getByRole("combobox", { name: "Search, plan or add" });
  expect(box).toHaveValue(chip.textContent);
  expect(await screen.findByRole("option", { name: /^Put Beef Ragu on / })).toHaveAttribute("aria-selected", "true");
  await user.keyboard("{Enter}");

  const tomorrow = addDays(today, 1);
  await waitFor(() => expect(rpc.addPlanEntry).toHaveBeenCalledWith({ data: { date: tomorrow, recipeId: ragu.id, text: "Beef Ragu" } }));
  await waitFor(() => expect(toastStore.snapshot()).toHaveLength(1));
  expect(toastStore.snapshot()[0]).toMatchObject({ options: { intent: "success", title: `Beef Ragu is on ${dayName(tomorrow)}` } });
  expect(invalidate).toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("tapping the shopping option adds the line to the list", async () => {
  const user = userEvent.setup();
  await app();
  await openSheet(user);
  await user.type(screen.getByRole("combobox", { name: "Search, plan or add" }), "oat milk");
  await user.click(await screen.findByRole("option", { name: /to the shopping list/ }));

  await waitFor(() => expect(rpc.addShoppingItems).toHaveBeenCalledWith({ data: { items: [{ text: "oat milk" }] } }));
  await waitFor(() => expect(toastStore.snapshot()).toHaveLength(1));
  expect(toastStore.snapshot()[0]).toMatchObject({ options: { intent: "success", title: "Added “oat milk” to the shopping list" } });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("tapping a recipe opens it", async () => {
  const user = userEvent.setup();
  const { router } = await app();
  await openSheet(user);
  await user.type(screen.getByRole("combobox", { name: "Search, plan or add" }), "rice");
  await user.click(await screen.findByRole("option", { name: "Fried Rice" }));
  await screen.findByRole("heading", { name: "A recipe" });
  expect(router.state.location.pathname).toBe("/recipes/fried-rice");
  expect(screen.queryByRole("dialog")).toBeNull();
});
