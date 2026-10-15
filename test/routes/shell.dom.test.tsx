// What the address decides in the shell, drawn once the page is the browser's
// (decisions.md row 169): cook mode is fullscreen, a task hides the phone's
// tab bar, and the current place is marked. Before hydration the shell is the
// same for every address; test/routes/shell.test.tsx holds that side.
//
// The shell under a small tree of its own, with the flags the real routes
// carry, since this project's DOM tests have no database for the real loaders;
// the last test checks the real routes carry those flags.

import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { AppShell } from "../../src/components/shell/AppShell";

function shellAt(path: string) {
  const root = createRootRoute({ component: AppShell });
  const page = (at: string, staticData = {}) => createRoute({ getParentRoute: () => root, path: at, staticData, component: () => <h1>{at}</h1> });
  const tree = root.addChildren([
    page("/"),
    page("/settings"),
    page("/cook", { fullscreen: true }),
    page("/edit", { hideNav: true }),
    page("/new", { hideNav: (search: Record<string, unknown>) => search.source !== undefined }),
  ]);
  const router = createRouter({ routeTree: tree, history: createMemoryHistory({ initialEntries: [path] }) });
  return render(<RouterProvider router={router} />);
}

test("a fullscreen route draws the outlet without either nav", async () => {
  shellAt("/cook");
  expect(await screen.findByRole("heading", { name: "/cook" })).toBeInTheDocument();
  expect(screen.queryAllByRole("navigation", { name: "Main" })).toHaveLength(0);
});

test.each(["/edit", "/new?source=manual"])("%s hides the phone tab bar and keeps the side nav", async (path) => {
  const { container } = shellAt(path);
  await screen.findByRole("heading");
  const navs = screen.getAllByRole("navigation", { name: "Main" });
  expect(navs).toHaveLength(1);
  expect(navs[0]!.closest("aside")).not.toBeNull();
  expect(container.innerHTML).toContain("[--app-bar:0px]");
});

test("the new-recipe chooser keeps the tab bar", async () => {
  shellAt("/new");
  await screen.findByRole("heading");
  expect(screen.getAllByRole("navigation", { name: "Main" })).toHaveLength(2);
});

test("only the current place is marked, in both navs", async () => {
  shellAt("/settings");
  await screen.findByRole("heading");
  const current = screen.getAllByRole("link", { current: "page" });
  expect(current.map((link) => link.getAttribute("href"))).toEqual(["/settings", "/settings"]);
});

test("the real routes carry the flags the shell reads", async () => {
  const cook = (await import("../../src/routes/recipes/recipe/cook/route")).Route.options.staticData;
  const edit = (await import("../../src/routes/recipes/recipe/edit/route")).Route.options.staticData;
  const fresh = (await import("../../src/routes/recipes/new/route")).Route.options.staticData;
  expect(cook?.fullscreen).toBe(true);
  expect(edit?.hideNav).toBe(true);
  const hideNew = fresh?.hideNav as (search: Record<string, unknown>) => boolean;
  expect(hideNew({ source: "manual" })).toBe(true);
  expect(hideNew({})).toBe(false);
});
