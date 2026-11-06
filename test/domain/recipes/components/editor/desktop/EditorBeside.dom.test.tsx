// The editor on a desktop (decisions.md row 207): the recipe as it will be
// saved, redrawn beside the form as it is typed, and on an import's Check the
// text it read, each line lit by the row made from it.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { RecipeForm } from "../../../../../../src/domain/recipes/components/editor/RecipeForm";
import { emptyDraft, type RecipeDraft } from "../../../../../../src/domain/recipes/draft";
import { renderInRouter } from "../../../../../helpers/dom";
import { atDesktop } from "../../../../../helpers/layout";

atDesktop();

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

function draft(): RecipeDraft {
  return {
    ...emptyDraft(),
    name: "Fried rice",
    parts: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "",
        ingredients: [
          { id: "22222222-2222-4222-8222-222222222222", originalText: "2 eggs", note: "" },
          { id: "33333333-3333-4333-8333-333333333333", originalText: "1 tbsp soy sauce", note: "" },
        ],
        steps: [{ id: "44444444-4444-4444-8444-444444444444", text: "Fry the rice.", title: "", summary: "", ingredientIds: [] }],
      },
    ],
  };
}

const preview = () => screen.getByTestId("draft-preview");

test("the preview follows the draft as it is typed, and nothing in it is a control", async () => {
  const user = userEvent.setup();
  await renderInRouter(<RecipeForm initial={emptyDraft()} units={[]} tags={[]} storage={memory()} />);
  expect(within(preview()).getByTestId("preview-name")).toHaveTextContent("Untitled recipe");

  await user.type(screen.getByRole("textbox", { name: /^Name/ }), "Lemon tart");
  expect(within(preview()).getByTestId("preview-name")).toHaveTextContent("Lemon tart");

  await user.type(screen.getByRole("textbox", { name: "Description" }), "Sharp and short.");
  expect(preview()).toHaveTextContent("Sharp and short.");

  // A preview writes nothing: no tick boxes, no timers, no buttons, no links.
  expect(within(preview()).queryAllByRole("checkbox")).toHaveLength(0);
  expect(within(preview()).queryAllByRole("button")).toHaveLength(0);
  expect(within(preview()).queryAllByRole("link")).toHaveLength(0);
});

test("an ingredient and a step typed in the form show in the preview's two lists", async () => {
  const user = userEvent.setup();
  await renderInRouter(<RecipeForm initial={draft()} units={[]} tags={[]} storage={memory()} />);
  const ingredients = within(preview()).getByRole("region", { name: "Ingredients" });
  expect(ingredients).toHaveTextContent("2 eggs");

  await user.type(screen.getByRole("textbox", { name: "Ingredient 1 text" }), ", beaten");
  expect(ingredients).toHaveTextContent("2 eggs, beaten");

  const step = screen.getByRole("textbox", { name: "Step 1" });
  await user.clear(step);
  await user.type(step, "Fry the rice hard.");
  expect(within(preview()).getByRole("region", { name: "Method" })).toHaveTextContent("Fry the rice hard.");
});

const SOURCE = ["# Fried rice", "Posted on Tuesday", "▢ 2 eggs", "▢ 1 tbsp soy sauce", "Fry the rice.", "Comments (12)"].join("\n");

async function renderCheck() {
  const check = { pending: {}, note: null, duplicate: null, suggestedTags: [], onBack: vi.fn(), sourceText: SOURCE };
  await renderInRouter(<RecipeForm initial={draft()} units={[]} tags={[]} storage={memory()} isImport importCheck={check} />);
}

const line = (n: number) => document.querySelector(`[data-source-line="${n}"]`)!;

test("on Check the text it read is beside the form, the lines nothing came from greyed", async () => {
  await renderCheck();
  const source = screen.getByTestId("source-view");
  expect(source).toHaveTextContent("4 of 6 lines used");
  expect(line(1)).toHaveAttribute("data-used", "true");
  expect(line(2)).not.toHaveAttribute("data-used");
  expect(line(3)).toHaveAttribute("data-used", "true");
  expect(line(6)).not.toHaveAttribute("data-used");
});

test("pointing at an ingredient or focusing a step lights the line it was made from", async () => {
  const user = userEvent.setup();
  await renderCheck();
  expect(document.querySelector("[data-lit]")).toBeNull();

  await user.hover(screen.getByRole("textbox", { name: "Ingredient 2 text" }));
  expect(line(4)).toHaveAttribute("data-lit", "true");
  expect(document.querySelectorAll("[data-lit]")).toHaveLength(1);

  await user.unhover(screen.getByRole("textbox", { name: "Ingredient 2 text" }));
  screen.getByRole("textbox", { name: "Step 1" }).focus();
  // The pointer has left the form; the row with focus is the one lit.
  await user.pointer({ target: document.body });
  expect(line(5)).toHaveAttribute("data-lit", "true");
});

test("Preview and Source share the column, Source first", async () => {
  const user = userEvent.setup();
  await renderCheck();
  expect(screen.getByTestId("source-view")).toBeInTheDocument();
  expect(screen.queryByTestId("draft-preview")).toBeNull();

  await user.click(screen.getByRole("radio", { name: "Preview" }));
  expect(screen.getByTestId("draft-preview")).toBeInTheDocument();
  expect(screen.queryByTestId("source-view")).toBeNull();
});
