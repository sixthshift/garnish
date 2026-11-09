// The import's Style stage pressed (decisions.md row 203): Cancel is its way out
// (critique #11), Back returns to Check, Skip saves the steps as written while
// the rewrite runs, and a rewrite that fails leaves Save working. The model and
// the guide are faked: nothing here may reach a hosted model.
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ImportStyle } from "../../../../../src/domain/recipes/components/new/ImportStyle";
import { draftFromInput, emptyDraft } from "../../../../../src/domain/recipes/draft";
import { recipeInputSchema } from "../../../../../src/domain/recipes/recipe";

const model = vi.hoisted(() => ({ restyleDraft: vi.fn(() => new Promise(() => {})), createRestyledRecipe: vi.fn() }));
vi.mock("../../../../../src/server/ai/restyle", () => model);
const rpc = vi.hoisted(() => ({
  createRecipe: vi.fn(async (_: { data: { name: string } }) => ({ id: "99999999-9999-4999-8999-999999999999", slug: "kung-pao-chicken" })),
}));
vi.mock("../../../../../src/api/rpc/recipes", async (importOriginal) => ({ ...(await importOriginal<object>()), createRecipe: rpc.createRecipe }));
vi.mock("../../../../../src/api/rpc/style", () => ({ listStyleRules: vi.fn(async () => []) }));

async function renderStage(draft: ReturnType<typeof emptyDraft>, onCancel: () => void, onBack: () => void = () => {}) {
  const rootRoute = createRootRoute({
    component: () => <ImportStyle draft={draft} imageUrl={null} file={null} onBack={onBack} onCancel={onCancel} />,
  });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ["/"] }) });
  await router.load();
  render(<RouterProvider router={router} />);
}

const valid = draftFromInput(
  recipeInputSchema.parse({ name: "Kung pao chicken", parts: [{ name: "", ingredients: [], steps: [{ text: "Toast the peanuts." }] }] })
);

test("Cancel asks before it drops the import, and Keep stays on Style", async () => {
  const onCancel = vi.fn();
  const user = userEvent.setup();
  await renderStage(valid, onCancel);
  await user.click(await screen.findByRole("button", { name: "Cancel" }));
  const dialog = screen.getByRole("dialog", { name: "Discard this import" });
  await user.click(screen.getAllByRole("button", { name: "Cancel" }).find((button) => dialog.contains(button))!);
  expect(onCancel).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Discard" }));
  expect(onCancel).toHaveBeenCalledOnce();
});

test("a draft that needs a fix can still be left", async () => {
  const onCancel = vi.fn();
  const user = userEvent.setup();
  await renderStage(emptyDraft(), onCancel);
  await user.click(await screen.findByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Discard" }));
  expect(onCancel).toHaveBeenCalledOnce();
});

test("Back returns to Check", async () => {
  const onBack = vi.fn();
  const user = userEvent.setup();
  await renderStage(valid, () => {}, onBack);
  await user.click(await screen.findByRole("button", { name: "Back" }));
  expect(onBack).toHaveBeenCalledOnce();
});

test("while the rewrite runs, Skip saves the recipe as written", async () => {
  rpc.createRecipe.mockClear();
  model.restyleDraft.mockImplementation(() => new Promise(() => {}));
  const user = userEvent.setup();
  await renderStage(valid, () => {});
  expect(await screen.findByText("Rewriting in your house style…")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Skip, save as written" }));
  await waitFor(() => expect(rpc.createRecipe).toHaveBeenCalledOnce());
  expect(rpc.createRecipe.mock.calls[0]![0].data.name).toBe("Kung pao chicken");
  expect(model.createRestyledRecipe).not.toHaveBeenCalled();
});

test("a rewrite that fails says so once, and Save keeps the steps as written", async () => {
  rpc.createRecipe.mockClear();
  model.restyleDraft.mockImplementation(() => Promise.reject(new Error("The model could not be reached.")));
  const user = userEvent.setup();
  await renderStage(valid, () => {});
  expect(await screen.findByTestId("style-error")).toHaveTextContent("Couldn't rewrite this in your house style");
  expect(screen.getByText("Toast the peanuts.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save as written" }));
  await waitFor(() => expect(rpc.createRecipe).toHaveBeenCalledOnce());
});
