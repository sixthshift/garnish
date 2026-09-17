// The global search dialog's keyboard, driven rather than read. The node
// suite can assert the markup this renders; only a DOM can press a key in it.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { GlobalSearchContent } from "../../../src/components/shell/GlobalSearchContent";
import type { RecipeSummary } from "../../../src/domain/recipe";
import { renderInRouter } from "../../helpers/dom";

const summary = (id: string, name: string): RecipeSummary =>
  ({
    id,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    description: "",
    image: null,
    rating: null,
    favourite: false,
    totalTime: null,
    prepTime: null,
    cookTime: null,
    lastMade: null,
    tags: [],
    ingredientPreview: [],
  }) as unknown as RecipeSummary;

const results = [summary("1", "Lemon tart"), summary("2", "Ragu"), summary("3", "Hollandaise")];

/** The dialog body with every callback a spy, at `selected`. Its rows are RecipeCards, so it needs a router. */
async function renderContent(selected = 0) {
  const spies = { onQueryChange: vi.fn(), onSelect: vi.fn(), onOpen: vi.fn() };
  await renderInRouter(<GlobalSearchContent query="a" results={results} selected={selected} {...spies} />);
  return { ...spies, input: screen.getByRole("textbox", { name: "Search recipes" }) };
}

test("the arrow keys move the highlight and Enter opens the highlighted result", async () => {
  const user = userEvent.setup();
  const { onSelect, onOpen, input } = await renderContent(0);

  input.focus();
  await user.keyboard("{ArrowDown}");
  expect(onSelect).toHaveBeenCalledWith(1);

  await user.keyboard("{Enter}");
  expect(onOpen).toHaveBeenCalledWith(0); // the prop, not the spy's argument: selection is the caller's state
});

test("Enter on the clear button clears the query instead of opening a recipe", async () => {
  const user = userEvent.setup();
  const { onQueryChange, onOpen } = await renderContent(0);

  // The handler used to sit on the wrapper div, where the button's Enter
  // bubbled into it and opened the selected result instead of clearing.
  await user.click(screen.getByRole("button", { name: /clear/i }));
  expect(onQueryChange).toHaveBeenCalledWith("");
  expect(onOpen).not.toHaveBeenCalled();
});

test("typing reports the query and the highlighted row is the selected one", async () => {
  const user = userEvent.setup();
  const { onQueryChange, input } = await renderContent(1);

  await user.type(input, "b");
  expect(onQueryChange).toHaveBeenCalled();

  const options = screen.getAllByRole("option");
  expect(options[1]!).toHaveAttribute("aria-selected", "true");
  expect(options[0]!).toHaveAttribute("aria-selected", "false");
});

test("hovering a row moves the highlight to it", async () => {
  const user = userEvent.setup();
  const { onSelect } = await renderContent(0);

  await user.hover(screen.getAllByRole("option")[2]!);
  expect(onSelect).toHaveBeenCalledWith(2);
});

test("with no results the list is gone and the empty line explains why", () => {
  render(<GlobalSearchContent query="zzz" results={[]} selected={0} onQueryChange={vi.fn()} onSelect={vi.fn()} onOpen={vi.fn()} />);

  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(screen.getByText("No recipes match.")).toBeInTheDocument();
});
