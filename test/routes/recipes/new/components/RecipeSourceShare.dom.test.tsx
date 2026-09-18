// A shared address is read the moment the URL stage mounts, once, and lands
// on the review; a typed address still waits for "Read the page".
import { screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { ImportedRecipe } from "../../../../../src/domain/import";
import type { Unit } from "../../../../../src/domain/reference";
import { RecipeSource } from "../../../../../src/routes/recipes/new/components/RecipeSource";
import { renderInRouter } from "../../../../helpers/dom";

const gram: Unit = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  standardQuantity: null,
  standardUnitId: null,
};

const SOURCE = "https://example.test/anzac-biscuits";

const found: ImportedRecipe = {
  from: "schema",
  url: SOURCE,
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

function props(load: (url: string) => Promise<ImportedRecipe>) {
  return { units: [gram], source: "url" as const, onChoose: () => {}, onDraft: () => {}, loadFoods: async () => [], load };
}

test("a shared address is read on mount, once, and the review opens on it", async () => {
  const load = vi.fn(async () => found);
  await renderInRouter(<RecipeSource {...props(load)} initialUrl={SOURCE} />);

  await waitFor(() => expect(screen.getByText("Anzac biscuits")).toBeInTheDocument());
  expect(load).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledWith(SOURCE);
});

test("with nothing shared the stage waits for the button", async () => {
  const load = vi.fn(async () => found);
  await renderInRouter(<RecipeSource {...props(load)} />);

  expect(screen.getByLabelText("Recipe address")).toHaveValue("");
  expect(load).not.toHaveBeenCalled();
});
