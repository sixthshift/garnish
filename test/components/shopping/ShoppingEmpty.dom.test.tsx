// The shopping list with nothing on it: Add this week's plan puts the week on the list and says how much.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ShoppingEmpty } from "../../../src/components/shopping/ShoppingEmpty";
import { weekMonday } from "../../../src/domain/plan/plan";
import { renderInRouter } from "../../helpers/dom";

const addPlanWeekToShopping = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
vi.mock("../../../src/api/rpc/plan", () => ({ addPlanWeekToShopping }));
vi.mock("@sixthshift/design-system/overlay", async (actual) => ({ ...(await actual<object>()), toast }));

test("Add this week's plan adds the week beginning this Monday and says how many lines it added", async () => {
  addPlanWeekToShopping.mockResolvedValue({ added: 12 });
  await renderInRouter(<ShoppingEmpty primary />);
  expect(screen.getByText("Nothing on the list.")).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: "Add this week's plan" }));
  await waitFor(() => expect(toast).toHaveBeenCalledWith({ intent: "success", title: "12 items added" }));
  expect(addPlanWeekToShopping).toHaveBeenCalledWith({ data: { monday: weekMonday(undefined) } });
});

test("a week with nothing to buy says so rather than claiming none added", async () => {
  addPlanWeekToShopping.mockResolvedValue({ added: 0 });
  await renderInRouter(<ShoppingEmpty />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Add this week's plan" }));
  await waitFor(() => expect(toast).toHaveBeenCalledWith({ intent: "info", title: "Nothing planned this week needs buying" }));
});
