// The shopping list (M31.4): one household list, one page, no owner.
//
// The read is the whole list in `position` order and the page draws
// `groupByAisle` over it (src/domain/shopping/shopping.ts) — headings in
// `aisle.position` order, the unaisled under "Other" at the foot of the
// unticked lines, and every ticked line in a "Ticked" group below them with
// **Clear ticked**. The grouping is a pure function so this file stays a
// render of it.
//
// Phone first: the tick box and the row body are both full-height tap targets,
// the sources expand through a `<details>` (the browser's own keyboard and
// aria behaviour, and it renders its content whether open or closed, so a
// test sees it without a DOM), and nothing anywhere depends on hover.
//
// `ShoppingListView` takes its writes as callbacks and renders anywhere; the
// route component binds them to the server functions through `useMutate`, the
// way every other page writes. That split is what the render tests exercise.
//
// M31.6: a row whose food has no aisle gets a quiet "Set aisle" control in its
// expansion — a `Select` over the same aisles Settings manages, writing the
// food through `updateFood`. Aisles and foods are still only *managed* in
// Settings; this is a shortcut to the one field the list cares about. The
// loader fetches the aisle list alongside the items so the Select has
// something to offer; picking one invalidates the loader like every other
// write, so the row leaves "Other" on the next read rather than being moved
// locally.
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useMutate } from "../../lib/mutate";
import { notify, notifyError } from "../../lib/notify";
import { applyOutbox, type OutboxKind, useOutbox } from "../../lib/outbox";
import { useOnline } from "../../lib/useOnline";
import { addShoppingItems, clearTickedShoppingItems, removeShoppingItem, tickShoppingItem } from "../../server/fns/shopping";
import { ShoppingListView, sendOutboxEntry, setFoodAisle } from "./components/ShoppingListView";
import { Route } from "./route";

/**
 * The route's own wiring. Reads are the loader's (the service worker's data
 * cache answers them offline); writes are server-first as everywhere else,
 * with one exception: a tick, an untick or a remove made with no network — or
 * one whose write fails anyway, `navigator.onLine` being optimistic — goes
 * into the outbox instead and is applied to the rendered list at once. The
 * header says how many are waiting until they land.
 */
export function ShoppingPage() {
  const { items, aisles } = Route.useLoaderData();
  const mutate = useMutate();
  const router = useRouter();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const { queue, push } = useOutbox({ send: sendOutboxEntry, online, onFlushed: () => void router.invalidate() });

  const write = async (what: string, run: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await mutate(run);
    } catch (error) {
      notifyError(what, error);
    } finally {
      setBusy(false);
    }
  };

  /** A tick or a remove: straight through when there is a network, queued when there is not or when it fails. */
  const queued = (itemId: string, kind: OutboxKind, run: () => Promise<unknown>) => {
    if (!online) {
      push(itemId, kind);
      return;
    }
    void (async () => {
      setBusy(true);
      try {
        await mutate(run);
      } catch {
        push(itemId, kind);
        notify({ intent: "warning", title: "Saved for when you're back online" });
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <ShoppingListView
      items={applyOutbox(items, queue)}
      aisles={aisles}
      busy={busy}
      pending={queue.length}
      offline={!online}
      onAdd={(text) => void write("Couldn't add the item", () => addShoppingItems({ data: { items: [{ text }] } }))}
      onTick={(id, ticked) => queued(id, ticked ? "tick" : "untick", () => tickShoppingItem({ data: { id, ticked } }))}
      onRemove={(id) => queued(id, "remove", () => removeShoppingItem({ data: { id } }))}
      onClearTicked={() =>
        void write("Couldn't clear the ticked items", async () => {
          const { removed } = await clearTickedShoppingItems();
          notify({ intent: "success", title: `${removed} ${removed === 1 ? "item" : "items"} cleared` });
        })
      }
      onSetAisle={(foodId, aisleId) => void write("Couldn't set the aisle", () => setFoodAisle(foodId, aisleId))}
    />
  );
}
