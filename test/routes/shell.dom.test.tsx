// What the address and the screen decide in the shell, drawn once the page is
// the browser's (decisions.md rows 169, 206): cook mode is fullscreen, a phone
// gets the tab bar and a desktop the top bar, a task hides the phone's tab
// bar, and the current place is marked. Before hydration the shell is the
// same for every address; test/routes/shell.test.tsx holds that side.
//
// The shell under a small tree of its own, with the flags the real routes
// carry, since this project's DOM tests have no database for the real loaders;
// the last test checks the real routes carry those flags.

import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AppShell } from "../../src/app/components/layout/AppShell";
import { atDesktop, resizeTo } from "../helpers/layout";

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

test("a phone gets the tab bar alone, at the screen's foot", async () => {
  shellAt("/");
  await screen.findByRole("heading");
  const navs = screen.getAllByRole("navigation", { name: "Main" });
  expect(navs).toHaveLength(1);
  expect(navs[0]!.closest("header")).toBeNull();
  expect(navs[0]!.className).toContain("bottom-0");
});

test.each(["/edit", "/new?source=manual"])("%s hides the phone's tab bar", async (path) => {
  const { container } = shellAt(path);
  await screen.findByRole("heading");
  expect(screen.queryAllByRole("navigation", { name: "Main" })).toHaveLength(0);
  expect(container.innerHTML).toContain("[--app-bar:0px]");
});

test("the new-recipe chooser keeps the tab bar", async () => {
  shellAt("/new");
  await screen.findByRole("heading");
  expect(screen.getAllByRole("navigation", { name: "Main" })).toHaveLength(1);
});

test("only the current place is marked", async () => {
  shellAt("/settings");
  await screen.findByRole("heading");
  const current = screen.getAllByRole("link", { current: "page" });
  expect(current.map((link) => link.getAttribute("href"))).toEqual(["/settings"]);
});

test("crossing the line swaps the layout and keeps the page", async () => {
  shellAt("/");
  await screen.findByRole("heading", { name: "/" });
  expect(screen.getByRole("navigation", { name: "Main" }).closest("header")).toBeNull();
  resizeTo(1440);
  await waitFor(() => expect(screen.getByRole("navigation", { name: "Main" }).closest("header")).not.toBeNull());
  expect(screen.getByRole("heading", { name: "/" })).toBeInTheDocument();
  resizeTo(390);
});

describe("on a desktop", () => {
  atDesktop();

  test("the top bar alone, which a task keeps", async () => {
    shellAt("/edit");
    await screen.findByRole("heading", { name: "/edit" });
    const navs = screen.getAllByRole("navigation", { name: "Main" });
    expect(navs).toHaveLength(1);
    expect(navs[0]!.closest("header")).not.toBeNull();
  });
});

test("the real routes carry the flags the shell reads", async () => {
  const cook = (await import("../../src/domain/recipes/routes/cook")).recipeCook.options.staticData;
  const edit = (await import("../../src/domain/recipes/routes/edit")).recipeEdit.options.staticData;
  const fresh = (await import("../../src/domain/recipes/routes/new")).recipeNew.options.staticData;
  expect(cook?.fullscreen).toBe(true);
  expect(edit?.hideNav).toBe(true);
  const hideNew = fresh?.hideNav as (search: Record<string, unknown>) => boolean;
  expect(hideNew({ source: "manual" })).toBe(true);
  expect(hideNew({})).toBe(false);
});
