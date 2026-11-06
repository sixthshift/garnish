// A desktop's command bar (decisions.md row 207): Ctrl K opens it over any
// page, the arrows and Enter choose, a recipe opens, a trailing day plans it,
// and anything else goes on the shopping list.
import { toastStore } from "@sixthshift/design-system/overlay";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DesktopLayout } from "../../../src/app/desktop/components/DesktopLayout";
import { PanelSearch } from "../../../src/app/model/panel";
import { todayIso } from "../../../src/domain/plan/plan";
import { atDesktop } from "../../helpers/layout";

const ragu = { id: "00000000-0000-4000-8000-000000000001", slug: "beef-ragu", name: "Beef Ragu", image: null };
const rice = { id: "00000000-0000-4000-8000-000000000002", slug: "fried-rice", name: "Fried Rice", image: null };

const rpc = vi.hoisted(() => ({
  listRecipes: vi.fn(),
  listPlanWeek: vi.fn(),
  addPlanEntry: vi.fn(),
  addShoppingItems: vi.fn(),
}));
vi.mock("../../../src/api/rpc/recipes", () => ({ listRecipes: rpc.listRecipes, getRecipe: vi.fn(), subRecipesOf: async () => [] }));
vi.mock("../../../src/api/rpc/plan", () => ({ listPlanWeek: rpc.listPlanWeek, addPlanEntry: rpc.addPlanEntry }));
vi.mock("../../../src/api/rpc/shopping", () => ({ addShoppingItems: rpc.addShoppingItems }));

rpc.listRecipes.mockImplementation(async ({ data }: { data: { q: string } }) => [ragu, rice].filter((r) => r.name.toLowerCase().includes(data.q)));
rpc.listPlanWeek.mockImplementation(async () => []);
rpc.addPlanEntry.mockImplementation(async () => ({}));
rpc.addShoppingItems.mockImplementation(async () => []);

afterEach(() => {
  for (const record of toastStore.snapshot()) toastStore.remove(record.id);
  vi.clearAllMocks();
});

/** The desktop layout over a home page with a notes field, and a recipe page, at `/`. */
async function app() {
  const root = createRootRoute({ validateSearch: PanelSearch, component: DesktopLayout });
  const home = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => (
      <>
        <h1>Home</h1>
        <input aria-label="Notes" />
      </>
    ),
  });
  const recipe = createRoute({ getParentRoute: () => root, path: "recipes/$slug", component: () => <h1>A recipe</h1> });
  const anywhere = createRoute({ getParentRoute: () => root, path: "$", component: () => <h1>Elsewhere</h1> });
  const router = createRouter({ routeTree: root.addChildren([home, recipe, anywhere]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  const invalidate = vi.spyOn(router, "invalidate");
  await router.load();
  render(<RouterProvider router={router as never} />);
  await screen.findByRole("heading", { name: "Home" });
  return { router, invalidate };
}

describe("on a desktop", () => {
  atDesktop();

  test("Ctrl K opens the bar with its box focused, and again closes it", async () => {
    const user = userEvent.setup();
    await app();
    expect(screen.queryByRole("dialog", { name: "Command bar" })).toBeNull();
    await user.keyboard("{Control>}k{/Control}");
    const box = await screen.findByRole("combobox", { name: "Search, plan or add" });
    expect(box).toHaveFocus();
    // The empty bar: next week, import, the places.
    expect(screen.getByRole("option", { name: /Plan next week/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Settings/ })).toBeInTheDocument();
    await user.keyboard("{Control>}k{/Control}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Command bar" })).toBeNull());
  });

  test("/ opens it, but not while a field is being typed in; the pill opens it too", async () => {
    const user = userEvent.setup();
    await app();
    await user.click(screen.getByRole("textbox", { name: "Notes" }));
    await user.keyboard("/");
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("/");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("heading", { name: "Home" }));
    await user.keyboard("/");
    expect(await screen.findByRole("combobox", { name: "Search, plan or add" })).toHaveValue("");
    await user.keyboard("{Escape}");
    // Escape plays the modal's exit and reports the close on `animationend`, which happy-dom never fires.
    fireEvent.animationEnd(screen.getByRole("dialog"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(screen.getByRole("button", { name: /Search, plan or add anything/ }));
    expect(await screen.findByRole("combobox", { name: "Search, plan or add" })).toBeInTheDocument();
  });

  test("the arrows move the highlight and Enter opens the recipe it is on", async () => {
    const user = userEvent.setup();
    const { router } = await app();
    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("r");
    // Both recipes have an "r"; the line for the shopping list comes last.
    await screen.findByRole("option", { name: "Fried Rice" });
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Beef Ragu", "Fried Rice", "→Recipes", "+Add “r” to the shopping list"]);
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "Fried Rice" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "Fried Rice" }).id);
    await user.keyboard("{Enter}");

    await screen.findByRole("heading", { name: "A recipe" });
    expect(router.state.location.pathname).toBe("/recipes/fried-rice");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("a line no recipe matches goes on the shopping list, with a toast and the page's data read again", async () => {
    const user = userEvent.setup();
    const { invalidate } = await app();
    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("oat milk");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(rpc.addShoppingItems).toHaveBeenCalledWith({ data: { items: [{ text: "oat milk" }] } }));
    await waitFor(() => expect(toastStore.snapshot()).toHaveLength(1));
    expect(toastStore.snapshot()[0]).toMatchObject({ options: { intent: "success", title: "Added “oat milk” to the shopping list" } });
    expect(invalidate).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("a recipe and a day puts it on that day", async () => {
    const user = userEvent.setup();
    await app();
    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("ragu tonight");
    const plan = await screen.findByRole("option", { name: /^Put Beef Ragu on / });
    expect(plan).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("option", { name: /shopping list/ })).toBeNull();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(rpc.addPlanEntry).toHaveBeenCalledWith({ data: { date: todayIso(), recipeId: ragu.id, text: "Beef Ragu" } }));
    await waitFor(() => expect(toastStore.snapshot()).toHaveLength(1));
  });

  test("the empty bar offers what is on tonight", async () => {
    const user = userEvent.setup();
    const today = todayIso();
    rpc.listPlanWeek.mockImplementation(async () => [{ date: today, entries: [{ id: "e1", date: today, position: 0, recipe: ragu, text: "" }] }]);
    await app();
    await user.keyboard("{Control>}k{/Control}");
    const tonight = await screen.findByRole("option", { name: /Beef Ragu/ });
    expect(tonight).toHaveTextContent("On tonight");
    rpc.listPlanWeek.mockImplementation(async () => []);
  });
});
