// Render every page route through the real route tree with a memory history.
// A stub that throws, a missing route, or a bad import shows up here before
// it does in the browser.
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { RouteError, RouteNotFound, RoutePending } from "../../src/components/RouteStates";
import { routeTree } from "../../src/routeTree.gen";

async function render(path: string): Promise<string> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPendingComponent: RoutePending,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
  });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

const pages: Array<[string, string]> = [
  ["/", "Recipes"],
  ["/recipes/new", "New recipe"],
  ["/recipes/lemon-tart", "lemon-tart"],
  ["/recipes/lemon-tart/edit", "Edit recipe"],
  ["/settings", "Settings"],
];

describe("app shell", () => {
  test.each(pages)("%s renders inside the shell", async (path, text) => {
    const html = await render(path);
    expect(html).toContain(text);
    // Both navs are in the DOM; CSS decides which shows.
    expect(html.match(/aria-label="Main"/g)).toHaveLength(2);
    for (const label of ["Recipes", "New", "Settings"]) expect(html).toContain(`>${label}</a>`);
  });

  test("unknown path renders the not-found view", async () => {
    const html = await render("/nowhere");
    expect(html).toContain("Not found");
    expect(html).toContain('href="/"');
  });

  test("only the current nav item is active", async () => {
    const html = await render("/settings");
    const active = html.match(/data-status="active"/g) ?? [];
    // One per nav (side + bottom).
    expect(active).toHaveLength(2);
    expect(html).toMatch(/href="\/settings"[^>]*data-status="active"|data-status="active"[^>]*href="\/settings"/);
  });
});

describe("route states", () => {
  test("pending shows a spinner with sr text", () => {
    const html = renderToString(<RoutePending />);
    expect(html).toContain("<svg");
    expect(html).toContain("Loading");
  });

  test("error shows the message and a retry button", () => {
    const html = renderToString(
      <RouteError error={new Error("boom")} reset={() => {}} info={{ componentStack: "" }} />,
    );
    expect(html).toContain("boom");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Try again");
  });
});
