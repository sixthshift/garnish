// Critique #8: "Clear ticked" deleted every ticked line at once, from a red
// button, with nothing to bring them back. It now asks first: the button is
// neutral and the red is the dialog's.
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { type ShoppingItem, shoppingItemSchema } from "../../../src/domain/shopping";
import { ShoppingListView } from "../../../src/routes/shopping/components/ShoppingListView";
import { renderInRouter } from "../../helpers/dom";

const stamp = "2026-01-01T00:00:00.000Z";
function item(n: number, text: string, ticked: boolean): ShoppingItem {
  return shoppingItemSchema.parse({
    id: `99999999-9999-4999-8999-${String(n).padStart(12, "0")}`,
    position: n,
    createdAt: stamp,
    updatedAt: stamp,
    text,
    ticked,
  });
}
const items = [item(1, "Milk", true), item(2, "Eggs", true), item(3, "Bread", false)];
const noop = () => {};

async function mount(onClearTicked: () => void) {
  await renderInRouter(<ShoppingListView items={items} onAdd={noop} onTick={noop} onRemove={noop} onClearTicked={onClearTicked} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Clear ticked" }));
}

test("Clear ticked asks first, saying how many go, and clears on Clear", async () => {
  const onClearTicked = vi.fn();
  await mount(onClearTicked);
  expect(onClearTicked).not.toHaveBeenCalled();
  expect(screen.getByText("Clear 2 ticked items?")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Clear" }));
  expect(onClearTicked).toHaveBeenCalledOnce();
  expect(screen.queryByText("Clear 2 ticked items?")).toBeNull();
});

test("Cancel keeps the ticked lines", async () => {
  const onClearTicked = vi.fn();
  await mount(onClearTicked);
  await userEvent.setup().click(screen.getByRole("button", { name: "Cancel" }));
  expect(onClearTicked).not.toHaveBeenCalled();
  expect(screen.queryByText("Clear 2 ticked items?")).toBeNull();
});
