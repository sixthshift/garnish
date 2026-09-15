import { eq, max, sql } from "drizzle-orm";
import type { ParsedShoppingItemInput, ShoppingItem, ShoppingItemPatch, ShoppingItemSourceInput } from "../../../domain/shopping";
import type { ShoppingContext } from "./context";
import type { Readers } from "./read";
import { shoppingItem, shoppingItemSource } from "./schema";

/** `strftime(...)`, matching the column defaults; an update stamps it by hand. */
const nowUtc = sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

export function writers({ dz }: ShoppingContext, { get, list }: Readers) {
  /** The next free position: the end of the list, or 0 when it is empty. */
  function nextPosition(): number {
    const row = dz
      .select({ n: max(shoppingItem.position) })
      .from(shoppingItem)
      .get();
    return row?.n === null || row?.n === undefined ? 0 : row.n + 1;
  }

  return {
    /**
     * Append lines to the end of the list, with their sources, in one
     * transaction. Merging is the caller's job: this writes what it is
     * given. Returns the stored lines in the order they were added.
     */
    addMany(items: readonly ParsedShoppingItemInput[]): ShoppingItem[] {
      if (items.length === 0) return [];
      const ids = items.map(() => crypto.randomUUID());
      const start = nextPosition();
      dz.transaction((tx) => {
        items.forEach((item, index) => {
          tx.insert(shoppingItem)
            .values({
              id: ids[index]!,
              position: start + index,
              foodId: item.foodId,
              unitId: item.unitId,
              quantity: item.quantity,
              text: item.text,
              ticked: item.ticked,
            })
            .run();
          for (const source of item.sources) {
            tx.insert(shoppingItemSource)
              .values({
                id: crypto.randomUUID(),
                itemId: ids[index]!,
                recipeId: source.recipeId,
                recipeName: source.recipeName,
                partName: source.partName,
                servings: source.servings,
                quantity: source.quantity,
              })
              .run();
          }
        });
      });
      return ids.map((id) => get(id)!);
    },

    /**
     * Absorb additions into an existing line (`mergeIntoList`'s `merges`): set its new
     * total and append the sources that made it up, in one transaction. Null
     * when `id` is unknown. `update` cannot do this — a patch has no `sources`,
     * because every other write to a line leaves its provenance alone.
     */
    mergeInto(id: string, quantity: number | null, sources: readonly ShoppingItemSourceInput[]): ShoppingItem | null {
      if (!get(id)) return null;
      dz.transaction((tx) => {
        tx.update(shoppingItem).set({ quantity, updatedAt: nowUtc }).where(eq(shoppingItem.id, id)).run();
        for (const source of sources) {
          tx.insert(shoppingItemSource)
            .values({
              id: crypto.randomUUID(),
              itemId: id,
              recipeId: source.recipeId,
              recipeName: source.recipeName,
              partName: source.partName,
              servings: source.servings,
              quantity: source.quantity,
            })
            .run();
        }
      });
      return get(id);
    },

    /** Merge `patch` into a line and stamp `updated_at`. Null when `id` is unknown. */
    update(id: string, patch: ShoppingItemPatch): ShoppingItem | null {
      if (!get(id)) return null;
      dz.update(shoppingItem)
        .set({ ...patch, updatedAt: nowUtc })
        .where(eq(shoppingItem.id, id))
        .run();
      return get(id);
    },

    /** Tick or untick a line — the supermarket's only write. Null when `id` is unknown. */
    tick(id: string, ticked: boolean): ShoppingItem | null {
      const changed = dz.update(shoppingItem).set({ ticked, updatedAt: nowUtc }).where(eq(shoppingItem.id, id)).returning({ id: shoppingItem.id }).all();
      return changed.length > 0 ? get(id) : null;
    },

    /** True when a row was deleted. Its sources cascade with it. */
    remove: (id: string): boolean => dz.delete(shoppingItem).where(eq(shoppingItem.id, id)).returning({ id: shoppingItem.id }).all().length > 0,

    /** Delete every ticked line. Returns how many went. */
    clearTicked: (): number => dz.delete(shoppingItem).where(eq(shoppingItem.ticked, true)).returning({ id: shoppingItem.id }).all().length,

    /**
     * Set every line's position to its index in `ids`, in one transaction — the
     * drag-reorder list always sends the full order. An id that is not on the
     * list is a no-op UPDATE for that one. Returns the list afterwards.
     */
    reorder(ids: readonly string[]): ShoppingItem[] {
      dz.transaction((tx) => {
        ids.forEach((id, index) => {
          tx.update(shoppingItem).set({ position: index }).where(eq(shoppingItem.id, id)).run();
        });
      });
      return list();
    },
  };
}
