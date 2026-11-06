// One read before Check (decisions.md row 203): with a model, the source stage
// holds until the sort into parts lands, Skip ends the wait on the page's own
// reading, and a sort that fails hands Check that reading with one quiet line.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { RecipeSource } from "../../../../../src/domain/recipes/components/new/RecipeSource";
import type { ImportedCheck } from "../../../../../src/domain/recipes/components/new/reviewFlows";
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

function props(loadText: (text: string) => Promise<ImportedRecipe>, onDraft: (check: ImportedCheck) => void = () => {}) {
  return {
    units: [],
    source: "url" as const,
    initialUrl: SOURCE,
    aiAvailable: true,
    onChoose: () => {},
    onDraft,
    loadFoods: async () => [],
    load: async () => found,
    loadText,
  };
}

/** The part names of the draft Check was handed. */
const partNames = (onDraft: ReturnType<typeof vi.fn>) => (onDraft.mock.calls[0]![0] as ImportedCheck).draft.parts.map((part) => part.name);
const noteOf = (onDraft: ReturnType<typeof vi.fn>) => (onDraft.mock.calls[0]![0] as ImportedCheck).note;

test("Check is not opened until the sort lands, and then on the sorted recipe", async () => {
  const model = slowModel();
  const onDraft = vi.fn();
  await renderInRouter(<RecipeSource {...props(model.loadText, onDraft)} />);

  await waitFor(() => expect(model.loadText).toHaveBeenCalledTimes(1));
  expect(screen.getByText("Reading the recipe…")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Skip sorting into parts" })).toBeInTheDocument();
  expect(onDraft).not.toHaveBeenCalled();

  model.answer(sorted);
  await waitFor(() => expect(onDraft).toHaveBeenCalledTimes(1));
  expect(partNames(onDraft)).toEqual(["Pastry", "Filling"]);
  expect(noteOf(onDraft)).toBeNull();
});

test("Skip opens on the page's own reading, and an answer after it changes nothing", async () => {
  const model = slowModel();
  const onDraft = vi.fn();
  await renderInRouter(<RecipeSource {...props(model.loadText, onDraft)} />);
  await waitFor(() => expect(model.loadText).toHaveBeenCalledTimes(1));

  await userEvent.click(screen.getByRole("button", { name: "Skip sorting into parts" }));
  await waitFor(() => expect(onDraft).toHaveBeenCalledTimes(1));
  expect(partNames(onDraft)).toEqual([""]);
  expect(noteOf(onDraft)).toBeNull();

  model.answer(sorted);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(onDraft).toHaveBeenCalledTimes(1);
});

test("a sort that fails opens on the page's own reading with one quiet line", async () => {
  const model = slowModel();
  const onDraft = vi.fn();
  await renderInRouter(<RecipeSource {...props(model.loadText, onDraft)} />);
  await waitFor(() => expect(model.loadText).toHaveBeenCalledTimes(1));

  model.fail(new Error("The model could not be reached."));
  await waitFor(() => expect(onDraft).toHaveBeenCalledTimes(1));
  expect(noteOf(onDraft)).toBe("Couldn't sort this into parts. You can add parts yourself.");
  expect(partNames(onDraft)).toEqual([""]);
  expect(screen.queryByText(/could not be reached/)).not.toBeInTheDocument();
});

test("without a model there is nothing to skip and Check opens at once", async () => {
  const loadText = vi.fn(async () => sorted);
  const onDraft = vi.fn();
  await renderInRouter(<RecipeSource {...props(loadText, onDraft)} aiAvailable={false} />);
  await waitFor(() => expect(onDraft).toHaveBeenCalledTimes(1));
  expect(loadText).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Skip sorting into parts" })).not.toBeInTheDocument();
});
