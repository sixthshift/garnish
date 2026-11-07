// The library's search text: typing is instant, the address follows after a
// pause. The write that waits out the pause belongs to the page it was typed
// on — leaving the library before it lands (Enter on the side panel's recipe)
// must not pull the reader back with every other param gone, the flake
// e2e/desktop-library.spec.ts hit after Back, Forward and Enter.
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider, useSearch } from "@tanstack/react-router";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { useSearchText } from "../../../../../src/domain/recipes/components/library/useSearchText";
import { SEARCH_DEBOUNCE_MS } from "../../../../../src/lib/search";

function Library() {
  const q = useSearch({ strict: false, select: (search) => (search as { q?: string }).q ?? "" });
  const { query, setQuery } = useSearchText(q);
  return <input aria-label="Search recipes" value={query} onChange={(event) => setQuery(event.target.value)} />;
}

/** The library at `/recipes` and a recipe page whose loader waits until `release()`. */
async function app(path: string) {
  let release = () => {};
  const loading = new Promise<void>((resolve) => {
    release = resolve;
  });
  const root = createRootRoute();
  const library = createRoute({ getParentRoute: () => root, path: "/recipes", component: Library });
  const recipe = createRoute({
    getParentRoute: () => root,
    path: "/recipes/$slug",
    loader: () => loading,
    component: () => <h1>Recipe</h1>,
  });
  const router = createRouter({ routeTree: root.addChildren([library, recipe]), history: createMemoryHistory({ initialEntries: [path] }) });
  await router.load();
  render(<RouterProvider router={router as never} />);
  return { router, release: () => release() };
}

const pause = () => new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 100));

test("after a pause the address takes the text, keeping what else it holds", async () => {
  const { router } = await app("/recipes?sort=name");
  await userEvent.type(await screen.findByRole("textbox", { name: "Search recipes" }), "pane");
  await waitFor(() => expect(router.state.location.search).toEqual({ sort: "name", q: "pane" }));
  expect(router.state.location.pathname).toBe("/recipes");
});

test("text still waiting when the library is left is dropped with it, not written over the next page", async () => {
  const { router, release } = await app("/recipes?sort=name");
  await userEvent.type(await screen.findByRole("textbox", { name: "Search recipes" }), "pane");
  // Leave before the pause is over; the recipe's loader keeps the library mounted meanwhile.
  void router.navigate({ to: "/recipes/$slug", params: { slug: "banana" } });
  await act(pause);
  await act(async () => release());

  expect(await screen.findByRole("heading", { name: "Recipe" })).toBeTruthy();
  expect(router.state.location.href).toBe("/recipes/banana");
});
