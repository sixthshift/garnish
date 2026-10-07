// The import's Style stage pressed: Cancel is its way out (critique #11). Style
// and Edit details only lead to each other, and the phone shows no tab bar
// here, so without it the only exit was Save. The model and the guide are
// faked: nothing here may reach a hosted model.
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { draftFromInput, emptyDraft } from "../../../../../src/domain/draft";
import { recipeInputSchema } from "../../../../../src/domain/recipe";
import { ImportStyle } from "../../../../../src/routes/recipes/new/components/ImportStyle";

const model = vi.hoisted(() => ({ restyleDraft: vi.fn(() => new Promise(() => {})), createRestyledRecipe: vi.fn() }));
vi.mock("../../../../../src/server/ai/restyle", () => model);
vi.mock("../../../../../src/server/fns/style", () => ({ listStyleRules: vi.fn(async () => []) }));

async function renderStage(draft: ReturnType<typeof emptyDraft>, onCancel: () => void) {
  const rootRoute = createRootRoute({
    component: () => <ImportStyle draft={draft} imageUrl={null} file={null} onEditDetails={() => {}} onCancel={onCancel} />,
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
