import { addShoppingItems, removeShoppingItem, tickShoppingItem } from "../../../api/rpc/shopping";
import type { OutboxEntry } from "../../../lib/outbox";

/** One queued write, sent. The list's offline-able writes and nothing else. */
export function sendOutboxEntry(entry: OutboxEntry): Promise<unknown> {
  if (entry.kind === "add") return addShoppingItems({ data: { items: [{ text: entry.text, ticked: entry.ticked }] } });
  if (entry.kind === "remove") return removeShoppingItem({ data: { id: entry.itemId } });
  return tickShoppingItem({ data: { id: entry.itemId, ticked: entry.kind === "tick" } });
}
