import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { randomUuid } from "../../lib/id";
import { useMutate } from "../../lib/mutate";
import { notify, notifyError } from "../../lib/notify";
import { applyOutbox } from "../../lib/outbox";
import { useOnline } from "../../lib/useOnline";
import { useOutbox } from "../../lib/useOutbox";
import { addShoppingItems, clearTickedShoppingItems, removeShoppingItem, tickShoppingItem } from "../../server/fns/shopping";
import { ShoppingListView } from "./components/ShoppingListView";
import { sendOutboxEntry, setFoodAisle } from "./components/shoppingListActions";
import { Route } from "./route";

/**
 * The route's own wiring. Reads are the loader's (the service worker's data
 * cache answers them offline); writes are server-first as everywhere else,
 * with one exception: a tick, an untick, a remove or a typed line made with
 * no network — or one whose write fails anyway, `navigator.onLine` being
 * optimistic — goes into the outbox instead and is applied to the rendered
 * list at once. The header says how many are waiting until they land.
 */
export function ShoppingPage() {
  const { items, aisles } = Route.useLoaderData();
  const mutate = useMutate();
  const router = useRouter();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const { queue, push, add } = useOutbox({ send: sendOutboxEntry, online, onFlushed: () => void router.invalidate() });

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

  /** A tick, a remove or a typed line: straight through when there is a network, queued (`enqueue`) when there is not or when it fails. */
  const queued = (enqueue: () => void, run: () => Promise<unknown>) => {
    if (!online) {
      enqueue();
      return;
    }
    void (async () => {
      setBusy(true);
      try {
        await mutate(run);
      } catch {
        enqueue();
        notify({ intent: "warning", title: "Saved for when you're back online" });
      } finally {
        setBusy(false);
      }
    })();
  };

  /** A typed line gets its id on this device, so a tick on it before it lands has something to name. */
  const addLine = (text: string) => {
    const id = randomUuid();
    queued(
      () => add(id, text),
      () => addShoppingItems({ data: { items: [{ text }] } })
    );
  };

  return (
    <ShoppingListView
      items={applyOutbox(items, queue)}
      aisles={aisles}
      busy={busy}
      pending={queue.length}
      offline={!online}
      onAdd={addLine}
      onTick={(id, ticked) =>
        queued(
          () => push(id, ticked ? "tick" : "untick"),
          () => tickShoppingItem({ data: { id, ticked } })
        )
      }
      onRemove={(id) =>
        queued(
          () => push(id, "remove"),
          () => removeShoppingItem({ data: { id } })
        )
      }
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
