import type { ShoppingItem } from "../../../domain/shopping";
import type { OutboxEntry } from "../../../lib/outbox";
import { updateFood } from "../../../server/fns/foods";
import { addShoppingItems, removeShoppingItem, tickShoppingItem } from "../../../server/fns/shopping";

/** The "Set aisle" Select writes straight through `updateFood`. One line so the route and the tests share it. */
export function setFoodAisle(foodId: string, aisleId: string): Promise<unknown> {
  return updateFood({ data: { id: foodId, aisleId } });
}

/** One queued write, sent. The list's offline-able writes and nothing else. */
export function sendOutboxEntry(entry: OutboxEntry): Promise<unknown> {
  if (entry.kind === "add") return addShoppingItems({ data: { items: [{ text: entry.text, ticked: entry.ticked }] } });
  if (entry.kind === "remove") return removeShoppingItem({ data: { id: entry.itemId } });
  return tickShoppingItem({ data: { id: entry.itemId, ticked: entry.kind === "tick" } });
}

/** "3 items" / "1 item", ticked ones excluded: what is still to buy. Pure. */
export function toBuyLabel(items: readonly ShoppingItem[]): string {
  const count = items.filter((item) => !item.ticked).length;
  return `${count} ${count === 1 ? "item" : "items"} to buy`;
}
