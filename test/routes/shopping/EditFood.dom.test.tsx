// "Edit food" on a shopping row (decisions.md row 186): the food's own sheet,
// the one Settings › Foods uses, opens over the list with the food's sizes,
// and a save that lands closes it.
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { foodSchema, unitSchema } from "../../../src/domain/reference";
import { type ShoppingItem, shoppingItemSchema } from "../../../src/domain/shopping";
import { ShoppingListView } from "../../../src/routes/shopping/components/ShoppingListView";
import { renderInRouter } from "../../helpers/dom";

const stamp = "2026-01-01T00:00:00.000Z";
const gram = unitSchema.parse({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "gram", abbreviation: "g", useAbbreviation: true });
const butter = foodSchema.parse({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "butter" });
const line = (n: number, fields: Record<string, unknown>): ShoppingItem =>
  shoppingItemSchema.parse({ id: `99999999-9999-4999-8999-${String(n).padStart(12, "0")}`, position: n, createdAt: stamp, updatedAt: stamp, ...fields });
const items = [line(1, { quantity: 400, unit: gram, food: butter }), line(2, { text: "Batteries" })];
const noop = () => {};

async function mount(onSaveFood: (patch: unknown) => Promise<boolean>) {
  await renderInRouter(
    <ShoppingListView
      items={items}
      units={[gram]}
      packs={[{ id: "7a7a7a7a-7a7a-4a7a-8a7a-000000000001", foodId: butter.id, quantity: 250, unitId: gram.id }]}
      onSaveFood={onSaveFood}
      onCreateAisle={() => Promise.reject(new Error("unused"))}
      onAdd={noop}
      onTick={noop}
      onRemove={noop}
      onClearTicked={noop}
    />
  );
}

test("only a food line offers Edit food, and it opens the food's sheet with its sizes", async () => {
  await mount(() => Promise.resolve(true));
  const buttons = screen.getAllByRole("button", { name: "Edit food", hidden: true });
  expect(buttons).toHaveLength(1);
  await userEvent.setup().click(buttons[0]!);
  expect(screen.getByRole("dialog", { name: "Edit butter" })).toBeTruthy();
  expect((screen.getByRole("textbox", { name: "Size 1 amount" }) as HTMLInputElement).value).toBe("250");
});

test("a save that lands closes the sheet and sends the sizes; one that fails keeps it open", async () => {
  const onSaveFood = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await mount(onSaveFood);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Edit food", hidden: true }));
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(onSaveFood).toHaveBeenLastCalledWith(expect.objectContaining({ id: butter.id, packs: [{ quantity: 250, unitId: gram.id }] }));
  expect(screen.getByRole("dialog", { name: "Edit butter" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.queryByRole("dialog", { name: "Edit butter" })).toBeNull();
});
