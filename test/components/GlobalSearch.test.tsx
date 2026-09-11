// GlobalSearch's dialog body. Static render only (no jsdom in this project's
// vitest config, see FilterBar.test.tsx): these check markup, not click or
// keydown behaviour — the pure key-handling rules behind it live in
// test/domain/search.test.ts. Results render through `RecipeCard`, which
// needs a router for its `Link`, same as RecipeCard.test.tsx.
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { GlobalSearchContent, type GlobalSearchContentProps } from "../../src/components/GlobalSearch";
import type { RecipeSummary } from "../../src/domain/recipe";

const lemonTart: RecipeSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "lemon-tart",
  name: "Lemon tart",
  image: null,
  rating: null,
  prepTime: null,
  performTime: null,
  totalTime: null,
  lastMade: null,
  favourite: false,
  tags: [],
};

const soup: RecipeSummary = {
  ...lemonTart,
  id: "22222222-2222-4222-8222-222222222222",
  slug: "tomato-soup",
  name: "Tomato soup",
};

function noop() {}

/** Render inside a throwaway router, so a result card's `Link` resolves. */
async function render(props: GlobalSearchContentProps): Promise<string> {
  const rootRoute = createRootRoute({ component: () => <GlobalSearchContent {...props} /> });
  const slugRoute = createRoute({ getParentRoute: () => rootRoute, path: "/recipes/$slug", component: () => null });
  const router = createRouter({
    routeTree: rootRoute.addChildren([slugRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

describe("GlobalSearchContent", () => {
  test("an empty query invites typing, not 'no recipes match'", async () => {
    const html = await render({ query: "", onQueryChange: noop, results: [], selected: 0, onSelect: noop, onOpen: noop });
    expect(html).toContain("Start typing to search.");
    expect(html).not.toContain("No recipes match.");
    expect(html).toContain('aria-label="Search recipes"');
  });

  test("a query with no matches says so", async () => {
    const html = await render({ query: "asparagus", onQueryChange: noop, results: [], selected: 0, onSelect: noop, onOpen: noop });
    expect(html).toContain("No recipes match.");
  });

  test("loading takes priority over the empty-results copy", async () => {
    const html = await render({ query: "soup", onQueryChange: noop, results: [], loading: true, selected: 0, onSelect: noop, onOpen: noop });
    expect(html).toContain("Searching…");
    expect(html).not.toContain("No recipes match.");
  });

  test("every result renders once, as a listbox option", async () => {
    const html = await render({ query: "t", onQueryChange: noop, results: [lemonTart, soup], selected: 0, onSelect: noop, onOpen: noop });
    expect(html).toContain("Lemon tart");
    expect(html).toContain("Tomato soup");
    expect(html.match(/role="option"/g)).toHaveLength(2);
    expect(html).toContain('role="listbox"');
  });

  test("the selected index is marked, and only that one", async () => {
    const html = await render({ query: "t", onQueryChange: noop, results: [lemonTart, soup], selected: 1, onSelect: noop, onOpen: noop });
    expect(html).toMatch(/data-selected="true"[^]*Tomato soup/);
    expect(html).not.toMatch(/data-selected="true"[^]*Lemon tart/);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
  });
});
