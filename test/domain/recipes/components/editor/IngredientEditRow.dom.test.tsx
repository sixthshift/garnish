// On a desktop an ingredient is one line — amount, unit, food, note — and what
// left the line (Fixed, Text only, Move to, and on a narrow list the moves and
// Remove) is in the row's ⋯, which these press (critique #10). A phone's row is
// one tappable line, and its sheet holds those (decisions.md row 206).
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { IngredientsEditor } from "../../../../../src/domain/recipes/components/editor/IngredientsEditor";
import { addIngredient, addPart, emptyDraft, foodReference, type RecipeDraft, renamePart, updateIngredient } from "../../../../../src/domain/recipes/draft";
import { atDesktop } from "../../../../helpers/layout";

function tart(): RecipeDraft {
  let draft = renamePart(emptyDraft(), 0, "Pastry");
  draft = addPart(draft, "Filling");
  draft = addIngredient(draft, 0);
  draft = updateIngredient(draft, 0, 0, { quantity: 200, food: foodReference({ name: "flour" }) });
  draft = addIngredient(draft, 0);
  draft = updateIngredient(draft, 0, 1, { quantity: 1, food: foodReference({ name: "butter" }), note: "cold" });
  return draft;
}

/** The editor over a draft it keeps, so a press shows on the next render; `latest` is the draft now. */
function harness(initial: RecipeDraft) {
  const state = { latest: initial };
  function Harness() {
    const [draft, setDraft] = useState(initial);
    return (
      <IngredientsEditor
        draft={draft}
        pi={0}
        units={[]}
        onChange={(next) => {
          state.latest = next;
          setDraft(next);
        }}
      />
    );
  }
  render(<Harness />);
  return state;
}

const row = (ii: number) => document.querySelector<HTMLElement>(`[data-ingredient="${ii}"]`)!;

describe("on a desktop", () => {
  atDesktop();

  test("Fixed is a checkbox in the row's menu, and a Fixed line reads back with = before its amount", async () => {
    const user = userEvent.setup();
    const state = harness(tart());

    await user.click(screen.getByRole("button", { name: "Ingredient 2 actions" }));
    const fixed = screen.getByRole("menuitemcheckbox", { name: /Fixed/ });
    expect(fixed).toHaveAttribute("aria-checked", "false");
    await user.click(fixed);
    expect(state.latest.parts[0]!.ingredients[1]!.fixed).toBe(true);
    expect(within(row(1)).getByRole("button", { name: "Edit ingredient 2" }).querySelector("[data-read-amount]")?.textContent).toMatch(/^= /);

    await user.click(screen.getByRole("button", { name: "Ingredient 2 actions" }));
    expect(screen.getByRole("menuitemcheckbox", { name: /Fixed/ })).toHaveAttribute("aria-checked", "true");
  });

  test("Text only in the menu turns the line into one wide text field", async () => {
    const user = userEvent.setup();
    const state = harness(tart());

    await user.click(screen.getByRole("button", { name: "Ingredient 1 actions" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Text only" }));
    expect(row(0)).toHaveAttribute("data-mode", "text");
    expect(within(row(0)).queryByRole("textbox", { name: "Ingredient 1 quantity" })).toBeNull();
    expect(state.latest.parts[0]!.ingredients[0]).toMatchObject({ quantity: null, food: null });
  });

  test("Move to names each other part and moves the row there", async () => {
    const user = userEvent.setup();
    const state = harness(tart());

    await user.click(screen.getByRole("button", { name: "Ingredient 1 actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Move to Filling" }));
    expect(state.latest.parts[0]!.ingredients.map((r) => r.food?.name)).toEqual(["butter"]);
    expect(state.latest.parts[1]!.ingredients.map((r) => r.food?.name)).toEqual(["flour"]);
  });

  test("the menu's moves and Remove are for a narrow list only; Fixed and Text only are always in it", async () => {
    const user = userEvent.setup();
    const state = harness(tart());

    await user.click(screen.getByRole("button", { name: "Ingredient 1 actions" }));
    for (const name of ["Move up", "Move down", "Remove"]) expect(screen.getByRole("menuitem", { name }).className).toContain("@2xl:hidden");
    for (const name of [/Fixed/, "Text only"]) expect(screen.getByRole("menuitemcheckbox", { name }).className).not.toContain("hidden");
    expect(screen.getByRole("menuitem", { name: "Move up" })).toBeDisabled();
    await user.click(screen.getByRole("menuitem", { name: "Move down" }));
    expect(state.latest.parts[0]!.ingredients.map((r) => r.food?.name)).toEqual(["butter", "flour"]);

    await user.click(screen.getByRole("button", { name: "Ingredient 2 actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove" }));
    expect(state.latest.parts[0]!.ingredients.map((r) => r.food?.name)).toEqual(["butter"]);
  });

  test("Enter on the last row's note adds a row", async () => {
    const user = userEvent.setup();
    const state = harness(tart());

    // A line reads back until clicked, then opens into its fields in place (decisions.md row 211).
    await user.click(screen.getByRole("button", { name: "Edit ingredient 2" }));
    await user.click(screen.getByRole("textbox", { name: "Ingredient 2 note" }));
    await user.keyboard("{Enter}");
    expect(state.latest.parts[0]!.ingredients).toHaveLength(3);
    expect(screen.getByRole("textbox", { name: "Ingredient 3 note" })).toBeInTheDocument();
  });
});

test("on a phone the row's menu leaves Fixed, Text only and Move to to the sheet", async () => {
  harness(tart());
  expect(screen.getByRole("button", { name: "Edit ingredient 1" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Ingredient 1 actions" }));
  expect(screen.queryByRole("menuitemcheckbox", { name: /Fixed/ })).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "Move to Filling" })).toBeNull();
  expect(screen.getByRole("menuitem", { name: /Alternatives/ })).toBeInTheDocument();
});
