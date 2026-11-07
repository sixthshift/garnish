// Plain text pasted with no model (decisions.md row 203): nothing can read it,
// so Check opens on an empty recipe with the text in the ingredient box, to be
// sorted by hand. A page's HTML is still read by the rules, model or not.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { RecipeForm } from "../../../../../src/domain/recipes/components/editor/RecipeForm";
import { PASTE_NOTE } from "../../../../../src/domain/recipes/components/new/importSummary";
import { RecipeSource } from "../../../../../src/domain/recipes/components/new/RecipeSource";
import type { ImportedCheck } from "../../../../../src/domain/recipes/components/new/reviewFlows";
import { emptyDraft } from "../../../../../src/domain/recipes/draft";
import type { ImportedRecipe } from "../../../../../src/domain/recipes/import";
import { noFacets } from "../../../../../src/domain/recipes/recipe";
import { renderInRouter } from "../../../../helpers/dom";

vi.mock("../../../../../src/api/rpc/foods", async (importOriginal) => ({ ...(await importOriginal<object>()), listFoods: vi.fn(async () => []) }));

const TEXT = "Anzac biscuits\n1 cup plain flour\n125 g butter\nMix the dry ingredients.";

const read: ImportedRecipe = {
  from: "schema",
  url: "",
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
    parts: [{ name: "", ingredients: ["1 cup plain flour"], steps: ["Mix."] }],
  },
};

async function paste(text: string, loadText = vi.fn(async () => read)) {
  const onDraft = vi.fn();
  const user = userEvent.setup();
  await renderInRouter(<RecipeSource units={[]} source="paste" onChoose={() => {}} onDraft={onDraft} loadFoods={async () => []} loadText={loadText} />);
  await user.type(screen.getByRole("textbox", { name: "Pasted recipe" }), text);
  await user.click(screen.getByRole("button", { name: "Read the text" }));
  return { onDraft, loadText };
}

test("plain text with no model opens Check on an empty recipe, the text waiting to be sorted", async () => {
  const { onDraft, loadText } = await paste(TEXT);
  await waitFor(() => expect(onDraft).toHaveBeenCalledTimes(1));
  const check = onDraft.mock.calls[0]![0] as ImportedCheck;
  expect(loadText).not.toHaveBeenCalled();
  expect(check.pastedText).toBe(TEXT);
  expect(check.note).toBe(PASTE_NOTE);
  expect(check.draft.parts[0]!.ingredients).toEqual([]);
});

test("a page's HTML with no model is still read", async () => {
  const { onDraft, loadText } = await paste("<html><body>a recipe page</body></html>");
  await waitFor(() => expect(onDraft).toHaveBeenCalledTimes(1));
  expect(loadText).toHaveBeenCalledTimes(1);
  expect((onDraft.mock.calls[0]![0] as ImportedCheck).draft.name).toBe("Anzac biscuits");
});

test("on Check the pasted text is in the first part's ingredient box", async () => {
  const check = { pending: {}, note: PASTE_NOTE, duplicate: null, suggestedTags: [], onBack: () => {}, pastedText: TEXT };
  await renderInRouter(<RecipeForm initial={emptyDraft()} units={[]} tags={[]} isImport importCheck={check} />);
  expect(screen.getByRole("textbox", { name: "New ingredients" })).toHaveValue(TEXT);
  expect(screen.getByTestId("sort-note")).toHaveTextContent(PASTE_NOTE);
});
