// The recipe's parts split as the recipe page splits them (decisions.md row
// 211): every part's ingredients in one column, every part's steps in the
// next, a part named, moved and removed where its steps are.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import { IngredientsColumn, MethodColumn } from "../../../../../src/domain/recipes/components/editor/PartsColumns";
import { emptyDraft, type RecipeDraft } from "../../../../../src/domain/recipes/draft";
import { atDesktop } from "../../../../helpers/layout";

atDesktop();

function tart(): RecipeDraft {
  return {
    ...emptyDraft(),
    name: "Lemon tart",
    parts: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Pastry",
        ingredients: [{ id: "a1111111-1111-4111-8111-111111111111", originalText: "200 g flour" }],
        steps: [],
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Filling",
        ingredients: [],
        steps: [{ id: "b2222222-2222-4222-8222-222222222222", text: "Whisk.", title: "", summary: "", ingredientIds: [] }],
      },
    ],
  };
}

function Harness({ initial, state }: { initial: RecipeDraft; state: { latest: RecipeDraft } }) {
  const [draft, setDraft] = useState(initial);
  state.latest = draft;
  return (
    <>
      <IngredientsColumn draft={draft} onChange={setDraft} />
      <MethodColumn draft={draft} onChange={setDraft} />
    </>
  );
}

function harness(initial: RecipeDraft) {
  const state = { latest: initial };
  render(<Harness initial={initial} state={state} />);
  return state;
}

test("each part's ingredients sit under its name, its steps under its name box; a part with none of either says so quietly", () => {
  harness(tart());
  const ingredients = within(screen.getByRole("region", { name: "Ingredients" }));
  expect(ingredients.getByText("Pastry")).toBeInTheDocument();
  expect(ingredients.getByText("No ingredients of its own")).toBeInTheDocument();
  const method = within(screen.getByRole("region", { name: "Method" }));
  expect(method.getByRole("textbox", { name: "Part 1 name" })).toHaveValue("Pastry");
  expect(method.getByText("No steps of its own")).toBeInTheDocument();
  expect(method.getByRole("textbox", { name: "Step 1" })).toHaveValue("Whisk.");
});

test("renaming a part where its steps are renames it over its ingredients too", async () => {
  const user = userEvent.setup();
  harness(tart());
  const name = screen.getByRole("textbox", { name: "Part 1 name" });
  await user.clear(name);
  await user.type(name, "Shell");
  expect(within(screen.getByRole("region", { name: "Ingredients" })).getByText("Shell")).toBeInTheDocument();
});

test("a part's menu moves it, and removing one with content asks first", async () => {
  const user = userEvent.setup();
  const state = harness(tart());
  await user.click(screen.getByRole("button", { name: "Pastry actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Move part down" }));
  expect(state.latest.parts.map((part) => part.name)).toEqual(["Filling", "Pastry"]);

  await user.click(screen.getByRole("button", { name: "Pastry actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Remove part" }));
  await user.click(screen.getByRole("button", { name: "Remove" }));
  expect(state.latest.parts.map((part) => part.name)).toEqual(["Filling"]);
});

test("a flat recipe shows no parts: no names, no counts, just Ingredients and Method", () => {
  harness(emptyDraft());
  expect(screen.queryByRole("textbox", { name: "Part 1 name" })).toBeNull();
  // An empty flat recipe offers the paste boxes, not the quiet line a part with nothing of its own gets.
  expect(screen.getByRole("textbox", { name: "New ingredients" })).toBeInTheDocument();
  expect(screen.queryByText("No ingredients of its own")).toBeNull();
  expect(screen.getByRole("button", { name: "Add part" })).toBeInTheDocument();
});
