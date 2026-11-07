// A shared address is read the moment the URL stage mounts, once, and lands
// on the review; a typed address still waits for "Read the page".
import { screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { STUB_NOTE } from "../../../../../src/domain/recipes/components/new/importSummary";
import { RecipeSource } from "../../../../../src/domain/recipes/components/new/RecipeSource";
import type { ImportedCheck } from "../../../../../src/domain/recipes/components/new/reviewFlows";
import type { ImportedRecipe } from "../../../../../src/domain/recipes/import";
import { noFacets } from "../../../../../src/domain/recipes/recipe";
import type { Unit } from "../../../../../src/domain/recipes/reference";
import { renderInRouter } from "../../../../helpers/dom";

const gram: Unit = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  portion: false,
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
    facets: noFacets(),
    parts: [{ name: "", ingredients: ["200 g flour"], steps: ["Mix."] }],
  },
};

function props(load: (url: string) => Promise<ImportedRecipe>, onDraft: (check: ImportedCheck) => void = () => {}) {
  return { units: [gram], source: "url" as const, onChoose: () => {}, onDraft, loadFoods: async () => [], load };
}

test("a shared address is read on mount, once, and Check opens on it", async () => {
  const load = vi.fn(async () => found);
  const onDraft = vi.fn();
  await renderInRouter(<RecipeSource {...props(load, onDraft)} initialUrl={SOURCE} />);

  await waitFor(() => expect(onDraft).toHaveBeenCalledTimes(1));
  expect(onDraft.mock.calls[0]![0].draft.name).toBe("Anzac biscuits");
  expect(load).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledWith(SOURCE);
});

test("with nothing shared the stage waits for the button", async () => {
  const load = vi.fn(async () => found);
  await renderInRouter(<RecipeSource {...props(load)} />);

  expect(screen.getByLabelText("Recipe address")).toHaveValue("");
  expect(load).not.toHaveBeenCalled();
});

test("a page with no recipe on it still opens Check, which says so", async () => {
  const stub: ImportedRecipe = { ...found, from: "stub", recipe: { ...found.recipe, parts: [{ name: "", ingredients: [], steps: [] }] } };
  const onDraft = vi.fn();
  await renderInRouter(<RecipeSource {...props(async () => stub, onDraft)} initialUrl={SOURCE} />);
  await waitFor(() => expect(onDraft).toHaveBeenCalledTimes(1));
  const check = onDraft.mock.calls[0]![0] as ImportedCheck;
  expect(check.note).toBe(STUB_NOTE);
  expect(check.draft.name).toBe("Anzac biscuits");
  expect(check.draft.sourceUrl).toBe(SOURCE);
});
