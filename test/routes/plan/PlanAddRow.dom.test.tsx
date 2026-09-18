// The add row's meal chips, pressed rather than read (M39.1). The node suite
// asserts the three chips are there and unpressed; only a DOM can press one,
// type a line and see what the add carries.
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { PlanAddRow } from "../../../src/routes/plan/components/PlanAddRow";
import { renderInRouter } from "../../helpers/dom";

const MONDAY = "2026-09-14";

async function renderRow() {
  const spies = { onAddText: vi.fn(), onAddRecipe: vi.fn() };
  await renderInRouter(<PlanAddRow date={MONDAY} {...spies} />);
  return { ...spies, input: screen.getByRole("textbox", { name: "Add to Mon 14 Sep" }) };
}

test("an add with no chip pressed carries no meal", async () => {
  const user = userEvent.setup();
  const { onAddText, input } = await renderRow();

  await user.type(input, "Leftovers{Enter}");
  expect(onAddText).toHaveBeenCalledWith(MONDAY, "Leftovers", null);
});

test("the chip pressed at the time travels with the line, and is cleared after it", async () => {
  const user = userEvent.setup();
  const { onAddText, input } = await renderRow();

  await user.click(screen.getByRole("button", { name: "Lunch" }));
  expect(screen.getByRole("button", { name: "Lunch" })).toHaveAttribute("aria-pressed", "true");

  await user.type(input, "Leftovers{Enter}");
  expect(onAddText).toHaveBeenCalledWith(MONDAY, "Leftovers", "lunch");

  // A meal is said once: the next line on this day starts with no chip pressed.
  expect(screen.getByRole("button", { name: "Lunch" })).toHaveAttribute("aria-pressed", "false");
  await user.type(input, "Out{Enter}");
  expect(onAddText).toHaveBeenLastCalledWith(MONDAY, "Out", null);
});

test("a pressed chip can be pressed again to mean no meal", async () => {
  const user = userEvent.setup();
  const { onAddText, input } = await renderRow();

  await user.click(screen.getByRole("button", { name: "Dinner" }));
  await user.click(screen.getByRole("button", { name: "Dinner" }));
  expect(screen.getByRole("button", { name: "Dinner" })).toHaveAttribute("aria-pressed", "false");

  await user.type(input, "Leftovers{Enter}");
  expect(onAddText).toHaveBeenCalledWith(MONDAY, "Leftovers", null);
});
