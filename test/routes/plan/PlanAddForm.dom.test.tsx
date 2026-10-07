// The add sheet's form, pressed rather than read (M39.1, rebuilt by critique
// #9). The node suite asserts what the form and the week draw; only a DOM can
// press a chip, type a line, pick a result and see what the add carries.
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { groupByDay } from "../../../src/domain/plan";
import type { RecipeSummary } from "../../../src/domain/recipe";
import { PLAN_RESULT_LIMIT, PlanAddForm } from "../../../src/routes/plan/components/PlanAddForm";
import { PlanWeekView } from "../../../src/routes/plan/components/PlanWeekView";
import { renderInRouter } from "../../helpers/dom";

const MONDAY = "2026-09-14";
const tart = { id: "11111111-1111-4111-8111-111111111111", slug: "lemon-tart", name: "Lemon tart", image: null } as RecipeSummary;

async function renderForm() {
  const spies = { onAddText: vi.fn(), onAddRecipe: vi.fn(), onDone: vi.fn() };
  await renderInRouter(<PlanAddForm date={MONDAY} searchRecipes={async () => [tart]} {...spies} />);
  return { ...spies, input: screen.getByRole("textbox", { name: "Search recipes, or type a note" }) };
}

test("an add with no chip pressed carries no meal, and is done", async () => {
  const user = userEvent.setup();
  const { onAddText, onDone, input } = await renderForm();

  await user.type(input, "Leftovers");
  // The line is a button of its own, so a phone needs no Enter key to add one.
  await user.click(screen.getByRole("button", { name: "Add “Leftovers” as a note" }));
  expect(onAddText).toHaveBeenCalledWith(MONDAY, "Leftovers", null);
  expect(onDone).toHaveBeenCalledTimes(1);
});

test("the chip pressed at the time travels with the line, and is cleared after it", async () => {
  const user = userEvent.setup();
  const { onAddText, input } = await renderForm();

  await user.click(screen.getByRole("button", { name: "Lunch" }));
  expect(screen.getByRole("button", { name: "Lunch" })).toHaveAttribute("aria-pressed", "true");

  await user.type(input, "Out");
  await user.click(screen.getByRole("button", { name: "Add “Out” as a note" }));
  expect(onAddText).toHaveBeenCalledWith(MONDAY, "Out", "lunch");

  // A meal is said once: the form starts again with no chip pressed.
  expect(screen.getByRole("button", { name: "Lunch" })).toHaveAttribute("aria-pressed", "false");
});

test("a pressed chip can be pressed again to mean no meal", async () => {
  const user = userEvent.setup();
  const { onAddText, input } = await renderForm();

  await user.click(screen.getByRole("button", { name: "Dinner" }));
  await user.click(screen.getByRole("button", { name: "Dinner" }));
  expect(screen.getByRole("button", { name: "Dinner" })).toHaveAttribute("aria-pressed", "false");

  await user.type(input, "Out");
  await user.click(screen.getByRole("button", { name: "Add “Out” as a note" }));
  expect(onAddText).toHaveBeenCalledWith(MONDAY, "Out", null);
});

test("a result picked from directly under the box is added with the chip pressed", async () => {
  const user = userEvent.setup();
  const { onAddRecipe, onAddText, onDone, input } = await renderForm();

  await user.click(screen.getByRole("button", { name: "Dinner" }));
  await user.type(input, "tart");
  await user.click(await screen.findByRole("option", { name: /Lemon tart/ }));
  expect(onAddRecipe).toHaveBeenCalledWith(MONDAY, tart, "dinner");
  expect(onAddText).not.toHaveBeenCalled();
  expect(onDone).toHaveBeenCalledTimes(1);
});

test("Enter adds the typed line as a note while no result is highlighted, even with results showing", async () => {
  const user = userEvent.setup();
  const { onAddRecipe, onAddText, onDone, input } = await renderForm();

  await user.type(input, "out");
  const option = await screen.findByRole("option", { name: /Lemon tart/ });
  expect(option).toHaveAttribute("aria-selected", "false");
  await user.type(input, "{Enter}");
  expect(onAddText).toHaveBeenCalledWith(MONDAY, "out", null);
  expect(onAddRecipe).not.toHaveBeenCalled();
  expect(onDone).toHaveBeenCalledTimes(1);
});

test("arrowing onto a result makes Enter add that recipe", async () => {
  const user = userEvent.setup();
  const { onAddRecipe, onAddText, input } = await renderForm();

  await user.type(input, "tart");
  const option = await screen.findByRole("option", { name: /Lemon tart/ });
  await user.keyboard("{ArrowDown}");
  expect(option).toHaveAttribute("aria-selected", "true");
  await user.keyboard("{Enter}");
  expect(onAddRecipe).toHaveBeenCalledWith(MONDAY, tart, null);
  expect(onAddText).not.toHaveBeenCalled();
});

test("ArrowUp from the first result, or typing on, lets go of the highlight", async () => {
  const user = userEvent.setup();
  const { onAddRecipe, onAddText, input } = await renderForm();

  await user.type(input, "tart");
  const option = await screen.findByRole("option", { name: /Lemon tart/ });
  await user.keyboard("{ArrowDown}{ArrowUp}");
  expect(option).toHaveAttribute("aria-selected", "false");

  await user.keyboard("{ArrowDown}");
  await user.type(input, "s");
  await waitFor(() => expect(screen.getByRole("option", { name: /Lemon tart/ })).toHaveAttribute("aria-selected", "false"));
  await user.keyboard("{Enter}");
  expect(onAddText).toHaveBeenCalledWith(MONDAY, "tarts", null);
  expect(onAddRecipe).not.toHaveBeenCalled();
});

test("a result that appears under a resting pointer is not highlighted, so Enter still adds the note (critique #15c)", async () => {
  const user = userEvent.setup();
  const { onAddRecipe, onAddText, input } = await renderForm();

  await user.type(input, "tart");
  const option = await screen.findByRole("option", { name: /Lemon tart/ });
  // What the browser sends when content moves in under a pointer that has not moved.
  fireEvent.mouseOver(option);
  fireEvent.mouseEnter(option);
  expect(option).toHaveAttribute("aria-selected", "false");
  await user.keyboard("{Enter}");
  expect(onAddText).toHaveBeenCalledWith(MONDAY, "tart", null);
  expect(onAddRecipe).not.toHaveBeenCalled();
});

test("moving the pointer over a result does highlight it", async () => {
  const user = userEvent.setup();
  const { input } = await renderForm();
  await user.type(input, "tart");
  const option = await screen.findByRole("option", { name: /Lemon tart/ });
  fireEvent.mouseMove(option);
  expect(option).toHaveAttribute("aria-selected", "true");
});

test("ArrowUp from the box stays in the box rather than jumping to the last result", async () => {
  const user = userEvent.setup();
  const { onAddRecipe, onAddText, input } = await renderForm();
  await user.type(input, "tart");
  const option = await screen.findByRole("option", { name: /Lemon tart/ });
  await user.keyboard("{ArrowUp}");
  expect(option).toHaveAttribute("aria-selected", "false");
  await user.keyboard("{Enter}");
  expect(onAddText).toHaveBeenCalledWith(MONDAY, "tart", null);
  expect(onAddRecipe).not.toHaveBeenCalled();
});

test("results stop at four, with the note row straight after them and a word on the rest", async () => {
  const user = userEvent.setup();
  const many = Array.from({ length: 7 }, (_, i) => ({ ...tart, id: `11111111-1111-4111-8111-00000000000${i}`, name: `Tart ${i}` }) as RecipeSummary);
  const spies = { onAddText: vi.fn(), onAddRecipe: vi.fn() };
  await renderInRouter(<PlanAddForm date={MONDAY} searchRecipes={async () => many} {...spies} />);

  await user.type(screen.getByRole("textbox", { name: "Search recipes, or type a note" }), "a");
  await screen.findAllByRole("option");
  expect(screen.getAllByRole("option")).toHaveLength(PLAN_RESULT_LIMIT);
  const note = screen.getByRole("button", { name: "Add “a” as a note" });
  const list = screen.getByRole("listbox");
  expect(list.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByTestId("plan-add-more")).toHaveTextContent("4 more recipes match");
});

test("a day's + opens its sheet, one add closes it, and focus comes back to the +", async () => {
  const user = userEvent.setup();
  const onAddRecipe = vi.fn();
  const noop = () => {};
  await renderInRouter(
    <PlanWeekView
      monday={MONDAY}
      days={groupByDay(MONDAY, [])}
      today="2026-09-16"
      searchRecipes={async () => [tart]}
      onAddText={noop}
      onAddRecipe={onAddRecipe}
      onMove={noop}
      onRemove={noop}
    />
  );

  const plus = screen.getByRole("button", { name: "Add to Tuesday 15 September" });
  await user.click(plus);
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent("Tuesday 15 September");
  // A fixed height on a phone, so the box does not move as results arrive.
  expect(dialog.className).toContain("max-sm:h-[92dvh]");
  // The box takes focus once the sheet has settled, so typing goes straight into it.
  const input = screen.getByRole("textbox", { name: "Search recipes, or type a note" });
  await waitFor(() => expect(input).toHaveFocus());

  await user.type(input, "tart");
  await user.click(await screen.findByRole("option", { name: /Lemon tart/ }));
  expect(onAddRecipe).toHaveBeenCalledWith("2026-09-15", tart, null);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(plus).toHaveFocus());
});
