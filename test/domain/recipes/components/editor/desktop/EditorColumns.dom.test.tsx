// The editor on a desktop (decisions.md row 211): the recipe page's three
// columns, each thing changed where the page shows it, and on an import's
// Check the text it read in the method's column, each line lit by the row
// made from it.
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

const column = (name: string) => screen.getByRole("region", { name });

test("the editor is the recipe page's three columns: what it is, the ingredients, the method; no preview beside them", async () => {
  await renderInRouter(<RecipeForm initial={draft()} units={[]} tags={[]} storage={memory()} />);
  const about = screen.getByTestId("about-column");
  expect(within(about).getByRole("textbox", { name: "Name" })).toHaveValue("Fried rice");
  expect(within(about).getByRole("spinbutton", { name: "Prep time (minutes)" })).toBeInTheDocument();
  // How it is cooked and what it is are edited where the page shows them, kept in the draft until Save.
  expect(within(about).queryByRole("radiogroup", { name: "How you cook it" })).toBeNull();
  expect(within(about).getByRole("button", { name: "Add course, cuisine and more" })).toBeInTheDocument();
  expect(within(column("Ingredients")).getByRole("button", { name: "Edit ingredient 1" })).toHaveTextContent("2 eggs");
  expect(within(column("Method")).getByRole("textbox", { name: "Step 1" })).toHaveValue("Fry the rice.");
  expect(screen.queryByTestId("draft-preview")).toBeNull();
});

test("an ingredient line reads back as the page shows it and opens into its fields in place", async () => {
  const user = userEvent.setup();
  await renderInRouter(<RecipeForm initial={draft()} units={[]} tags={[]} storage={memory()} />);
  expect(screen.queryByRole("textbox", { name: "Ingredient 1 text" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Edit ingredient 1" }));
  await user.type(screen.getByRole("textbox", { name: "Ingredient 1 text" }), ", beaten");
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.getByRole("button", { name: "Edit ingredient 1" })).toHaveTextContent("2 eggs, beaten");
});

const SOURCE = ["# Fried rice", "Posted on Tuesday", "▢ 2 eggs", "▢ 1 tbsp soy sauce", "Fry the rice.", "Comments (12)"].join("\n");

async function renderCheck() {
  const check = { pending: {}, note: null, duplicate: null, suggestedTags: [], onBack: vi.fn(), sourceText: SOURCE };
  await renderInRouter(<RecipeForm initial={draft()} units={[]} tags={[]} storage={memory()} isImport importCheck={check} />);
}

const line = (n: number) => document.querySelector(`[data-source-line="${n}"]`)!;

test("on Check the method column turns to the text it read, the lines nothing came from greyed", async () => {
  const user = userEvent.setup();
  await renderCheck();
  expect(screen.queryByTestId("source-view")).toBeNull();
  await user.click(screen.getByRole("radio", { name: "What the import read" }));
  const source = screen.getByTestId("source-view");
  expect(source).toHaveTextContent("4 of 6 lines used");
  expect(line(1)).toHaveAttribute("data-used", "true");
  expect(line(2)).not.toHaveAttribute("data-used");
  expect(line(3)).toHaveAttribute("data-used", "true");
  expect(line(6)).not.toHaveAttribute("data-used");
  await user.click(screen.getByRole("radio", { name: "Method" }));
  expect(screen.getByRole("textbox", { name: "Step 1" })).toBeVisible();
});

test("pointing at an ingredient lights the line it was made from", async () => {
  const user = userEvent.setup();
  await renderCheck();
  await user.click(screen.getByRole("radio", { name: "What the import read" }));
  expect(document.querySelector("[data-lit]")).toBeNull();
  await user.hover(screen.getByRole("button", { name: "Edit ingredient 2" }));
  expect(line(4)).toHaveAttribute("data-lit", "true");
  expect(document.querySelectorAll("[data-lit]")).toHaveLength(1);
});
