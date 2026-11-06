// One read before Check (decisions.md row 203): with a model, the source stage
// holds until the sort into parts lands, Skip ends the wait on the page's own
// reading, and a sort that fails opens Check on that reading with one quiet line.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { RecipeSource } from "../../../../../src/domain/recipes/components/new/RecipeSource";
import type { ImportedRecipe, ScrapedRecipe } from "../../../../../src/domain/recipes/import";
import { renderInRouter } from "../../../../helpers/dom";

const SOURCE = "https://recipes.example/lemon-tart";

const rulesRecipe: ScrapedRecipe = {
  name: "Lemon tart",
  description: "",
  image: null,
  servings: 8,
  yieldText: "",
  prepMinutes: null,
  cookMinutes: null,
  tags: [],
  parts: [{ name: "", ingredients: ["200 g flour", "100 g sugar"], steps: ["Rub in.", "Bake."] }],
};
const found: ImportedRecipe = { from: "schema", url: SOURCE, recipe: rulesRecipe, pageText: "# Pastry\n200 g flour\n# Filling\n100 g sugar" };
const sorted: ImportedRecipe = {
  from: "ai",
  url: SOURCE,
  pageText: "",
  check: { ok: true, missingLines: [], addedLines: [], missingSteps: [], addedSteps: [] },
  recipe: {
    ...rulesRecipe,
    parts: [
      { name: "Pastry", ingredients: ["200 g flour"], steps: ["Rub in."] },
      { name: "Filling", ingredients: ["100 g sugar"], steps: ["Bake."] },
    ],
  },
};

/** A model whose answer the test hands over when it likes. */
function slowModel() {
  let answer: (result: ImportedRecipe) => void = () => {};
  let fail: (cause: Error) => void = () => {};
  const loadText = vi.fn(
    () =>
      new Promise<ImportedRecipe>((resolve, reject) => {
        answer = resolve;
        fail = reject;
      })
  );
  return { loadText, answer: (result: ImportedRecipe) => answer(result), fail: (cause: Error) => fail(cause) };
}

function props(loadText: (text: string) => Promise<ImportedRecipe>) {
  return {
    units: [],
    source: "url" as const,
    initialUrl: SOURCE,
    aiAvailable: true,
    onChoose: () => {},
    onDraft: () => {},
    loadFoods: async () => [],
    load: async () => found,
    loadText,
  };
}

const partNames = () => [...document.querySelectorAll("[data-import-part]")].map((node) => node.getAttribute("data-import-part"));

test("nothing of the recipe is shown until the sort lands, and then it is the sorted one", async () => {
  const model = slowModel();
  await renderInRouter(<RecipeSource {...props(model.loadText)} />);

  await waitFor(() => expect(model.loadText).toHaveBeenCalledTimes(1));
  expect(screen.getByText("Reading the recipe…")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Skip sorting into parts" })).toBeInTheDocument();
  expect(screen.queryByText("Lemon tart")).not.toBeInTheDocument();

  model.answer(sorted);
  await waitFor(() => expect(screen.getByText("Lemon tart")).toBeInTheDocument());
  expect(partNames()).toEqual(["Pastry", "Filling"]);
  expect(screen.queryByTestId("sort-note")).not.toBeInTheDocument();
});

test("Skip opens on the page's own reading, and an answer after it changes nothing", async () => {
  const model = slowModel();
  await renderInRouter(<RecipeSource {...props(model.loadText)} />);
  await waitFor(() => expect(model.loadText).toHaveBeenCalledTimes(1));

  await userEvent.click(screen.getByRole("button", { name: "Skip sorting into parts" }));
  await waitFor(() => expect(screen.getByText("Lemon tart")).toBeInTheDocument());
  expect(partNames()).toEqual([""]);

  model.answer(sorted);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(partNames()).toEqual([""]);
  expect(screen.queryByTestId("sort-note")).not.toBeInTheDocument();
});

test("a sort that fails opens on the page's own reading with one quiet line", async () => {
  const model = slowModel();
  await renderInRouter(<RecipeSource {...props(model.loadText)} />);
  await waitFor(() => expect(model.loadText).toHaveBeenCalledTimes(1));

  model.fail(new Error("The model could not be reached."));
  await waitFor(() => expect(screen.getByTestId("sort-note")).toHaveTextContent("Couldn't sort this into parts. You can add parts yourself."));
  expect(partNames()).toEqual([""]);
  expect(screen.queryByText(/could not be reached/)).not.toBeInTheDocument();
});

test("without a model there is nothing to skip and the reading opens at once", async () => {
  const loadText = vi.fn(async () => sorted);
  await renderInRouter(<RecipeSource {...props(loadText)} aiAvailable={false} />);
  await waitFor(() => expect(screen.getByText("Lemon tart")).toBeInTheDocument());
  expect(loadText).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Skip sorting into parts" })).not.toBeInTheDocument();
});
