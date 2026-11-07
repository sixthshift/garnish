// What a recipe is, in the editor where the recipe page shows it (decisions.md
// row 211): how it is cooked and its course, cuisine and the rest are kept in
// the draft and written with Save, never on their own as the page writes them.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { RecipeForm } from "../../../../../src/domain/recipes/components/editor/RecipeForm";
import { emptyDraft } from "../../../../../src/domain/recipes/draft";
import { noFacets, type RecipeInput } from "../../../../../src/domain/recipes/recipe";
import { renderInRouter } from "../../../../helpers/dom";
import { atDesktop } from "../../../../helpers/layout";

const rpc = vi.hoisted(() => ({
  createRecipe: vi.fn(async (_: { data: unknown }) => ({ id: "99999999-9999-4999-8999-999999999999", slug: "larb" })),
  setKind: vi.fn(),
  setFacets: vi.fn(),
}));
vi.mock("../../../../../src/api/rpc/recipes", async (importOriginal) => ({ ...(await importOriginal<object>()), ...rpc }));

atDesktop();

beforeEach(() => {
  for (const fn of Object.values(rpc)) fn.mockClear();
});

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

test("Rotation and the course set in the editor are saved with the recipe, and nothing is written before Save", async () => {
  const user = userEvent.setup();
  await renderInRouter(<RecipeForm initial={{ ...emptyDraft(), name: "Larb" }} units={[]} tags={[]} storage={memory()} />);
  const about = within(screen.getByTestId("about-column"));
  await user.click(about.getByRole("radio", { name: "Rotation" }));
  await user.click(about.getByRole("button", { name: "Add course, cuisine and more" }));
  const sheet = within(screen.getByTestId("facet-sheet"));
  await user.click(sheet.getByRole("button", { name: /^Main$/ }));
  await user.click(sheet.getByRole("button", { name: "Thai" }));
  await user.click(screen.getByRole("button", { name: "Done" }));
  // The chips show in the editor, not as links that would leave it.
  const chips = within(about.getByTestId("facet-chips"));
  expect(chips.getByText("Thai")).toBeInTheDocument();
  expect(chips.queryByRole("link")).toBeNull();
  expect(rpc.setKind).not.toHaveBeenCalled();
  expect(rpc.setFacets).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Create recipe" }));
  await waitFor(() => expect(rpc.createRecipe).toHaveBeenCalledTimes(1));
  const saved = rpc.createRecipe.mock.calls[0]![0].data as RecipeInput;
  expect(saved.kind).toBe("rotation");
  expect(saved.facets).toEqual({ ...noFacets(), course: ["main"], cuisine: ["thai"] });
});

test("the times are typed where the page's strip has them, the total worked out beside them", async () => {
  const user = userEvent.setup();
  await renderInRouter(<RecipeForm initial={{ ...emptyDraft(), name: "Larb" }} units={[]} tags={[]} storage={memory()} />);
  await user.type(screen.getByRole("spinbutton", { name: "Prep time (minutes)" }), "15");
  await user.type(screen.getByRole("spinbutton", { name: "Cook time (minutes)" }), "75");
  expect(screen.getByTestId("times")).toHaveTextContent("Total 1 hr 30 min");
});
