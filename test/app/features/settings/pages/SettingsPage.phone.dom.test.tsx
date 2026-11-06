// A phone's Settings (decisions.md row 208): one grouped list, each place a
// row that opens it as its own screen at `?section=`, so it has an address and
// "‹ Settings" (or Back) comes back to the list; Home is the way out.
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { SettingsData } from "../../../../../src/app/features/settings/routes/settings";
import { SettingsSearch } from "../../../../../src/app/features/settings/routes/settings";

vi.mock("../../../../../src/api/rpc/foods", () => ({
  updateFood: vi.fn(),
  usingFood: vi.fn(async () => []),
  deleteFood: vi.fn(),
  mergeFood: vi.fn(),
  createFood: vi.fn(),
  setFoodPacks: vi.fn(),
}));
vi.mock("../../../../../src/api/rpc/aisles", () => ({ findOrCreateAisle: vi.fn() }));

const food = (id: string, name: string) => ({ id, name, pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false, conversions: [] });

const data: SettingsData = {
  aisles: [{ id: "aisle-1", name: "Pantry", position: 0 }],
  units: [],
  foods: [food("f1", "apple"), food("f2", "basil"), food("f3", "zucchini")],
  foodUsage: {},
  foodPacks: [],
  tags: [],
  recipes: [],
  styleRules: [],
  plannerRules: [],
  ai: { provider: null, problem: null, credential: "", configured: false, baseUrl: "", isDefaultProvider: true, models: [] },
  mcp: { url: "http://garnish.local/mcp", problem: null, pairingCode: "ABCD-1234", connections: [] },
  diagnostics: [],
};

/** The settings route alone, at its real id, over the data above, with Home beside it. */
async function settings(path = "/settings") {
  const { SettingsPage } = await import("../../../../../src/app/features/settings/pages/SettingsPage");
  const root = createRootRoute();
  const home = createRoute({ getParentRoute: () => root, path: "/", component: () => <h1>Tonight</h1> });
  const page = createRoute({ getParentRoute: () => root, path: "settings", validateSearch: SettingsSearch, loader: () => data, component: SettingsPage });
  const router = createRouter({ routeTree: root.addChildren([home, page]), history: createMemoryHistory({ initialEntries: [path] }) });
  await router.load();
  render(<RouterProvider router={router as never} />);
  await screen.findByRole("heading", { level: 1 });
  return router;
}

test("the list groups the places, each with its tile and count, and opens one at ?section=", async () => {
  const user = userEvent.setup();
  const router = await settings();
  expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeTruthy();
  expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Library", "Cooking", "Data", "App"]);
  const library = screen.getByRole("region", { name: "Library" });
  expect(
    within(library)
      .getAllByRole("link")
      .map((link) => link.textContent)
  ).toEqual(["❦Foods3", "⚖Units0", "▤Aisles1", "#Tags0"]);

  await user.click(screen.getByRole("link", { name: /Units/ }));
  await waitFor(() => expect(router.state.location.search).toEqual({ section: "units" }));
  expect(screen.getByRole("heading", { level: 1, name: "Units" })).toBeTruthy();
  expect(screen.queryByRole("heading", { level: 1, name: "Settings" })).toBeNull();

  // ‹ Settings goes back to the list, and so does the browser's Back.
  await user.click(screen.getByRole("link", { name: "Settings" }));
  await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeTruthy());
  expect(router.state.location.search).toEqual({});

  await user.click(screen.getByRole("link", { name: /Appearance/ }));
  await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Appearance" })).toBeTruthy());
  router.history.back();
  await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeTruthy());
});

test("a section's address opens it directly, and Home is the list's way out", async () => {
  const user = userEvent.setup();
  await settings("/settings?section=foods");
  expect(screen.getByRole("heading", { level: 1, name: "Foods" })).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Search foods" })).toBeTruthy();

  await user.click(screen.getByRole("link", { name: "Settings" }));
  await user.click(await screen.findByRole("link", { name: "Home" }));
  await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Tonight" })).toBeTruthy());
});
