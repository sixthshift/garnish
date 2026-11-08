// A desktop's side panel (decisions.md row 206): a recipe link opens the
// recipe beside the page, by the address, so the page stays put; Close and Esc
// take it off; a phone's same link goes to the recipe's page.
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { DesktopLayout } from "../../../src/app/desktop/components/DesktopLayout";
import { PanelSearch } from "../../../src/app/model/panel";
import { RecipeLink } from "../../../src/components/recipe/RecipeLink";
import type { Recipe } from "../../../src/domain/recipes/recipe";
import { noFacets } from "../../../src/domain/recipes/recipe";
import { atDesktop } from "../../helpers/layout";

const flourFood = { id: "food-flour", name: "flour", pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false, conversions: [] };
const flour = { id: "ing-flour", quantity: 200, unit: null, food: flourFood, note: "", originalText: "", fixed: false, alternatives: [] };
const tart: Recipe = {
  id: "recipe-tart",
  slug: "lemon-tart",
  name: "Lemon tart",
  description: "",
  image: null,
  rating: null,
  lastMade: null,
  recipeServings: 4,
  recipeYieldQuantity: 0,
  yieldUnit: null,
  recipeYield: "",
  prepTime: 20,
  performTime: 40,
  sourceUrl: null,
  favourite: false,
  facets: noFacets(),
  notes: [],
  tags: [],
  parts: [
    {
      id: "part-main",
      name: "",
      ingredients: [flour],
      steps: [{ id: "step-1", title: "", text: "Rub the butter into the flour.", summary: "", ingredientIds: [], image: null }],
    },
  ],
  restyledAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const getRecipe = vi.hoisted(() => vi.fn());
vi.mock("../../../src/api/rpc/recipes", () => ({ getRecipe, subRecipesOf: async () => [] }));
getRecipe.mockImplementation(async () => tart);

/** The desktop layout over a page with one recipe link on it, at `path`. */
async function app(path = "/") {
  const root = createRootRoute({ validateSearch: PanelSearch, component: DesktopLayout });
  const home = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => (
      <>
        <h1>Home</h1>
        <RecipeLink slug="lemon-tart">Lemon tart</RecipeLink>
        <input aria-label="Notes" />
      </>
    ),
  });
  const anywhere = createRoute({ getParentRoute: () => root, path: "$", component: () => <h1>Elsewhere</h1> });
  const router = createRouter({ routeTree: root.addChildren([home, anywhere]), history: createMemoryHistory({ initialEntries: [path] }) });
  await router.load();
  render(<RouterProvider router={router as never} />);
  await screen.findByRole("heading", { name: "Home" });
  return router;
}

describe("on a desktop", () => {
  atDesktop();

  test("a recipe link opens the recipe beside the page, by the address, with its title focused", async () => {
    const user = userEvent.setup();
    const router = await app();
    await user.click(screen.getByRole("link", { name: "Lemon tart" }));

    const panel = await screen.findByRole("complementary", { name: "Recipe" });
    const title = await screen.findByRole("heading", { name: "Lemon tart", level: 2 });
    expect(panel).toContainElement(title);
    expect(title).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
    expect(router.state.location.search).toEqual({ panel: { slug: "lemon-tart" } });
    expect(panel).toHaveTextContent("1 hr");
    expect(panel).toHaveTextContent("Serves 4");
    expect(panel).toHaveTextContent("Rub the butter into the flour.");
    expect(screen.getByRole("link", { name: "Start cooking" })).toHaveAttribute("href", "/recipes/lemon-tart?cooking=true");
    expect(screen.getByRole("link", { name: "Open the recipe" })).toHaveAttribute("href", "/recipes/lemon-tart");
  });

  test("Close takes it off the address, and the page stays", async () => {
    const user = userEvent.setup();
    const router = await app(`/?panel=${encodeURIComponent(JSON.stringify({ slug: "lemon-tart" }))}`);
    await screen.findByRole("heading", { name: "Lemon tart", level: 2 });
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary", { name: "Recipe" })).toBeNull();
    expect(router.state.location.search).toEqual({});
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
  });

  test("Esc closes it, but not while typing in a field", async () => {
    const user = userEvent.setup();
    await app(`/?panel=${encodeURIComponent(JSON.stringify({ slug: "lemon-tart" }))}`);
    await screen.findByRole("heading", { name: "Lemon tart", level: 2 });
    await user.click(screen.getByRole("textbox", { name: "Notes" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("complementary", { name: "Recipe" })).toBeInTheDocument();
    await act(async () => (document.activeElement as HTMLElement).blur());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("complementary", { name: "Recipe" })).toBeNull();
  });

  test("a recipe that will not load says so, with its page to try", async () => {
    getRecipe.mockRejectedValueOnce(new Error("gone"));
    await app(`/?panel=${encodeURIComponent(JSON.stringify({ slug: "gone" }))}`);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't open this recipe.");
    expect(screen.getByRole("link", { name: "Try its page" })).toHaveAttribute("href", "/recipes/gone");
  });

  test("a plan's choices and servings travel into the panel and on to the page", async () => {
    const user = userEvent.setup();
    await app(`/?panel=${encodeURIComponent(JSON.stringify({ slug: "lemon-tart", servings: 8 }))}`);
    await screen.findByRole("heading", { name: "Lemon tart", level: 2 });
    expect(screen.getByRole("complementary", { name: "Recipe" })).toHaveTextContent("400");
    expect(screen.getByRole("link", { name: "Start cooking" })).toHaveAttribute("href", "/recipes/lemon-tart?servings=8&cooking=true");
    await user.click(screen.getByRole("link", { name: "Open the recipe" }));
    expect(await screen.findByRole("heading", { name: "Elsewhere" })).toBeInTheDocument();
  });
});

test("on a phone the same link goes to the recipe's page", async () => {
  const user = userEvent.setup();
  const router = await app();
  expect(screen.getByRole("link", { name: "Lemon tart" })).toHaveAttribute("href", "/recipes/lemon-tart");
  await user.click(screen.getByRole("link", { name: "Lemon tart" }));
  await screen.findByRole("heading", { name: "Elsewhere" });
  expect(router.state.location.pathname).toBe("/recipes/lemon-tart");
});
