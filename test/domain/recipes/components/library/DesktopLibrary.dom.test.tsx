// A desktop's library as three panes (decisions.md row 207): a card opens the
// recipe in the side panel beside the wall, outlined while it is open there;
// the arrow keys (and j/k) flip through the cards in the wall's order, Enter
// opens the open one's page, and a key typed into a field is left alone.
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider, useSearch } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { DesktopLayout } from "../../../../../src/app/desktop/components/DesktopLayout";
import { PanelSearch } from "../../../../../src/app/model/panel";
import { DesktopLibrary } from "../../../../../src/domain/recipes/components/library/desktop/DesktopLibrary";
import type { Recipe, RecipeSummary } from "../../../../../src/domain/recipes/recipe";
import { noFacets } from "../../../../../src/domain/recipes/recipe";
import { atDesktop } from "../../../../helpers/layout";

const summary = (slug: string, name: string): RecipeSummary => ({
  id: crypto.randomUUID(),
  slug,
  name,
  image: null,
  rating: null,
  prepTime: null,
  performTime: null,
  totalTime: 30,
  lastMade: null,
  favourite: false,
  kind: null,
  facets: noFacets(),
  tags: [],
  ingredientPreview: [],
});

const library = [summary("laksa", "Laksa"), summary("ragu", "Ragu"), summary("tart", "Lemon tart")];

const getRecipe = vi.hoisted(() => vi.fn());
vi.mock("../../../../../src/api/rpc/recipes", () => ({ getRecipe, subRecipesOf: async () => [], setFavourite: vi.fn(), setKind: vi.fn() }));
getRecipe.mockImplementation(
  async ({ data }: { data: { slug: string } }): Promise<Recipe> => ({
    id: crypto.randomUUID(),
    slug: data.slug,
    name: library.find((recipe) => recipe.slug === data.slug)?.name ?? data.slug,
    description: "",
    image: null,
    rating: null,
    lastMade: null,
    recipeServings: 4,
    recipeYieldQuantity: 0,
    yieldUnit: null,
    recipeYield: "",
    prepTime: null,
    performTime: null,
    sourceUrl: null,
    favourite: false,
    kind: null,
    facets: noFacets(),
    notes: [],
    tags: [],
    parts: [{ id: crypto.randomUUID(), name: "", ingredients: [], steps: [] }],
    restyledAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  })
);

/** The library's panes as the page draws them, with the open recipe read from the address. */
function Library() {
  const open = useSearch({ strict: false, select: (search) => (search as { panel?: { slug: string } }).panel?.slug });
  return (
    <DesktopLibrary
      recipes={library}
      open={open}
      filtered={false}
      marking={null}
      onMarkingChange={() => {}}
      onDice={() => {}}
      filters={<input aria-label="Search recipes" />}
    />
  );
}

/** The desktop layout over the library at `/recipes`, with a recipe's page to go to. */
async function app(path = "/recipes") {
  const root = createRootRoute({ validateSearch: PanelSearch, component: DesktopLayout });
  const recipes = createRoute({ getParentRoute: () => root, path: "/recipes", component: Library });
  const page = createRoute({ getParentRoute: () => root, path: "/recipes/$slug", component: () => <h1>The recipe's page</h1> });
  const router = createRouter({ routeTree: root.addChildren([recipes, page]), history: createMemoryHistory({ initialEntries: [path] }) });
  await router.load();
  render(<RouterProvider router={router as never} />);
  await screen.findByRole("heading", { name: "Recipes" });
  return router;
}

const opened = (router: Awaited<ReturnType<typeof app>>) => (router.state.location.search as { panel?: { slug: string } }).panel?.slug;
const panelOf = (slug: string) => `/recipes?panel=${encodeURIComponent(JSON.stringify({ slug }))}`;

describe("on a desktop", () => {
  atDesktop();

  test("a card opens the recipe in the side panel and is outlined while it is open", async () => {
    const user = userEvent.setup();
    const router = await app();
    await user.click(screen.getByRole("link", { name: /Ragu/ }));
    await screen.findByRole("heading", { name: "Ragu", level: 2 });
    expect(opened(router)).toBe("ragu");
    // The router marks the card whose address is the open one's as current; the wall outlines it.
    expect(screen.getByRole("link", { name: /Ragu/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Ragu/ }).closest("[data-wall-slug]")).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("link", { name: /Laksa/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByTestId("flip-hint")).toHaveTextContent("← → to flip, Enter to open");
  });

  test("→ and j flip to the next card, ← and k to the one before, held at either end", async () => {
    const user = userEvent.setup();
    const router = await app(panelOf("laksa"));
    await screen.findByRole("heading", { name: "Laksa", level: 2 });

    await user.keyboard("{ArrowRight}");
    await screen.findByRole("heading", { name: "Ragu", level: 2 });
    expect(opened(router)).toBe("ragu");
    await user.keyboard("j");
    await screen.findByRole("heading", { name: "Lemon tart", level: 2 });
    await user.keyboard("{ArrowRight}");
    expect(opened(router)).toBe("tart");

    await user.keyboard("k");
    await waitFor(() => expect(opened(router)).toBe("ragu"));
    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(opened(router)).toBe("laksa"));
    await user.keyboard("{ArrowLeft}");
    expect(opened(router)).toBe("laksa");
    // A flip replaces the address, so Back closes the panel rather than stepping back through each recipe seen.
    expect(router.history.length).toBe(1);
  });

  test("Enter opens the open recipe's page", async () => {
    const user = userEvent.setup();
    const router = await app(panelOf("ragu"));
    await screen.findByRole("heading", { name: "Ragu", level: 2 });
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "The recipe's page" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recipes/ragu");
    expect(opened(router)).toBeUndefined();
  });

  test("keys typed into a field are the field's", async () => {
    const user = userEvent.setup();
    const router = await app(panelOf("laksa"));
    await screen.findByRole("heading", { name: "Laksa", level: 2 });
    await user.click(screen.getByRole("textbox", { name: "Search recipes" }));
    await user.keyboard("j{ArrowRight}{Enter}");
    expect(opened(router)).toBe("laksa");
    expect(router.state.location.pathname).toBe("/recipes");
  });

  test("with nothing open the keys do nothing", async () => {
    const user = userEvent.setup();
    const router = await app();
    await user.keyboard("{ArrowRight}{Enter}");
    expect(opened(router)).toBeUndefined();
    expect(router.state.location.pathname).toBe("/recipes");
    expect(screen.queryByTestId("flip-hint")).toBeNull();
  });
});
