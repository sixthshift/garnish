// The browser's Back from an import stage (critique #15c). The stages share
// one URL, so Back leaves /recipes/new; while a stage holds an import nobody
// has saved, it asks "Discard this import?" first, as the Style stage's Cancel
// does. The model, the guide and every read are faked: nothing here may reach
// a hosted model.
import { createBrowserHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { draftFromInput } from "../../../../../src/domain/draft";
import type { ImportedRecipe } from "../../../../../src/domain/import";
import { recipeInputSchema } from "../../../../../src/domain/recipe";
import { RecipeForm } from "../../../../../src/routes/recipes/components/RecipeForm";
import { ImportStyle } from "../../../../../src/routes/recipes/new/components/ImportStyle";
import { RecipeSource } from "../../../../../src/routes/recipes/new/components/RecipeSource";

const model = vi.hoisted(() => ({ restyleDraft: vi.fn(() => new Promise(() => {})), createRestyledRecipe: vi.fn() }));
vi.mock("../../../../../src/server/ai/restyle", () => model);
vi.mock("../../../../../src/server/fns/style", () => ({ listStyleRules: vi.fn(async () => []) }));

/**
 * `ui` on /recipes/new, with the page it was opened from one entry back. A
 * browser history, not a memory one: the router blocks Back on the browser's
 * popstate, and a memory history's Back never asks its blockers.
 */
async function renderStage(ui: ReactNode) {
  window.history.replaceState(null, "", "/recipes");
  const history = createBrowserHistory();
  // Through the router's history, so each entry carries the index its Back reads.
  history.push("/recipes/new");
  await new Promise((resolve) => setTimeout(resolve));
  const rootRoute = createRootRoute();
  const stage = createRoute({ getParentRoute: () => rootRoute, path: "/recipes/new", component: () => <>{ui}</> });
  const anywhere = createRoute({ getParentRoute: () => rootRoute, path: "$", component: () => null });
  const router = createRouter({ routeTree: rootRoute.addChildren([stage, anywhere]), history });
  await router.load();
  render(<RouterProvider router={router} />);
  const back = async () => {
    await act(async () => window.history.back());
  };
  const where = () => router.state.location.pathname;
  return { back, where };
}

/** Back asks; staying keeps the stage; asking again and discarding leaves. */
async function backAsksThenLeaves(stage: { back: () => Promise<void>; where: () => string }, stillThere: () => HTMLElement) {
  const user = userEvent.setup();
  await stage.back();
  const dialog = await screen.findByRole("dialog", { name: "Discard this import" });
  expect(stage.where()).toBe("/recipes/new");
  await user.click(screen.getAllByRole("button", { name: "Cancel" }).find((button) => dialog.contains(button))!);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(stage.where()).toBe("/recipes/new");
  expect(stillThere()).toBeInTheDocument();

  await stage.back();
  await screen.findByRole("dialog", { name: "Discard this import" });
  await user.click(screen.getByRole("button", { name: "Discard" }));
  await waitFor(() => expect(stage.where()).toBe("/recipes"));
}

const draft = draftFromInput(
  recipeInputSchema.parse({ name: "Kung pao chicken", parts: [{ name: "", ingredients: [], steps: [{ text: "Toast the peanuts." }] }] })
);

const found: ImportedRecipe = {
  from: "schema",
  url: "https://recipes.example/anzac",
  pageText: "",
  recipe: {
    name: "Anzac biscuits",
    description: "",
    image: null,
    servings: 24,
    yieldText: "",
    prepMinutes: null,
    cookMinutes: null,
    tags: [],
    parts: [{ name: "", ingredients: ["200 g flour"], steps: ["Mix."] }],
  },
};

/** A draft store of its own per test, so no stored draft greets the form. */
function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const sourceProps = { units: [], onChoose: () => {}, onDraft: () => {}, loadFoods: async () => [], load: async () => found };

test("Back from the Style stage asks before it drops the import", async () => {
  const stage = await renderStage(<ImportStyle draft={draft} imageUrl={null} file={null} onEditDetails={() => {}} onCancel={() => {}} />);
  await backAsksThenLeaves(stage, () => screen.getByRole("button", { name: "Edit details" }));
});

test("Back from the review asks before it drops the import", async () => {
  const stage = await renderStage(<RecipeSource {...sourceProps} source="url" initialUrl="https://recipes.example/anzac" />);
  await screen.findByText("Anzac biscuits");
  await backAsksThenLeaves(stage, () => screen.getByText("Anzac biscuits"));
});

test("Back from an empty source stage just leaves", async () => {
  const stage = await renderStage(<RecipeSource {...sourceProps} source="paste" aiAvailable loadText={async () => found} />);
  await stage.back();
  await waitFor(() => expect(stage.where()).toBe("/recipes"));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("Back from a paste with text in it asks", async () => {
  const user = userEvent.setup();
  const stage = await renderStage(<RecipeSource {...sourceProps} source="paste" aiAvailable loadText={async () => found} />);
  await user.type(screen.getByRole("textbox", { name: "Pasted recipe" }), "1 cup flour");
  // Only text so far: the question says so, not that a recipe would be lost.
  await stage.back();
  expect(await screen.findByRole("dialog", { name: "Discard this import" })).toHaveTextContent("loses the text you pasted");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await backAsksThenLeaves(stage, () => screen.getByRole("textbox", { name: "Pasted recipe" }));
});

test("Back from Edit details asks about the import even when nothing in it was changed", async () => {
  const stage = await renderStage(<RecipeForm initial={draft} units={[]} tags={[]} storage={memory()} isImport />);
  await backAsksThenLeaves(stage, () => screen.getAllByDisplayValue("Kung pao chicken")[0]!);
});

test("an untouched recipe typed in by hand is not an import, and Back leaves unasked", async () => {
  const stage = await renderStage(<RecipeForm initial={draft} units={[]} tags={[]} storage={memory()} />);
  await stage.back();
  await waitFor(() => expect(stage.where()).toBe("/recipes"));
  expect(screen.queryByRole("dialog")).toBeNull();
});
