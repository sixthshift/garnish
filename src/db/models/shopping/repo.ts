// Shopping list repository: the one household list (decisions.md row 67).
// Server-only; pass the Database opened by openDatabase.
//
// There is no list id because there is no second list. Every read is the whole
// list in `position` order — it is a phone screen's worth of rows, and the page
// groups it by aisle client-side rather than asking the database for an order
// it would then have to re-sort anyway.
//
// Lines are assembled the way the recipe document is: `food_id` and `unit_id`
// come back as nested objects (the food carrying its aisle), through the
// reference repositories, cached per read. A line whose food has since been
// deleted reads back with `food: null` and keeps its sources, which is the
// point of copying the names into `shopping_item_source`.
import type { Database } from "bun:sqlite";
import { asc, eq, inArray, max, sql } from "drizzle-orm";
import { aisles as aisleRepository } from "../aisle/repo";
import { foods as foodRepository } from "../food/repo";
import { units as unitRepository } from "../unit/repo";
import type { Food, Unit } from "../../../domain/recipe";
import type { ParsedShoppingItemInput, ShoppingItem, ShoppingItemPatch, ShoppingItemSourceInput } from "../../../domain/shopping";
import { orm } from "../../connection/client";
import { shoppingItem, shoppingItemSource } from "./schema";

/** `strftime(...)`, matching the column defaults; an update stamps it by hand. */
const nowUtc = sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

const order = [asc(shoppingItem.position), asc(shoppingItem.createdAt)];

export function shopping(db: Database) {
  const dz = orm(db);
  const units = unitRepository(db);
  const foods = foodRepository(db);
  const aisles = aisleRepository(db);

  // --- Document assembly ---------------------------------------------------

  function readUnit(id: string | null, cache: Map<string, Unit | null>): Unit | null {
    if (!id) return null;
    if (!cache.has(id)) cache.set(id, units.get(id));
    return cache.get(id) ?? null;
  }

  function readFood(id: string | null, cache: Map<string, Food | null>): Food | null {
    if (!id) return null;
    if (!cache.has(id)) {
      const row = foods.get(id);
      if (!row) cache.set(id, null);
      else {
        const { aisleId, ...rest } = row;
        cache.set(id, { ...rest, aisle: aisleId ? aisles.get(aisleId) : null });
      }
    }
    return cache.get(id) ?? null;
  }

  /** Turn stored rows into documents: nested food and unit, sources under their line. */
  function assemble(rows: (typeof shoppingItem.$inferSelect)[]): ShoppingItem[] {
    if (rows.length === 0) return [];
    const unitCache = new Map<string, Unit | null>();
    const foodCache = new Map<string, Food | null>();

    // Sources in the order they were written; rowid is that order, and the
    // table has no position column because nothing reorders them.
    const sourceRows = dz
      .select()
      .from(shoppingItemSource)
      .where(
        inArray(
          shoppingItemSource.itemId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(sql`rowid`)
      .all();

    const sourcesByItem = new Map<string, ShoppingItem["sources"]>();
    for (const s of sourceRows) {
      const list = sourcesByItem.get(s.itemId) ?? [];
      list.push({
        id: s.id,
        recipeId: s.recipeId,
        recipeName: s.recipeName,
        partName: s.partName,
        servings: s.servings,
        quantity: s.quantity,
      });
      sourcesByItem.set(s.itemId, list);
    }

    return rows.map((row) => ({
      id: row.id,
      position: row.position,
      quantity: row.quantity,
      unit: readUnit(row.unitId, unitCache),
      food: readFood(row.foodId, foodCache),
      text: row.text,
      ticked: row.ticked,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      sources: sourcesByItem.get(row.id) ?? [],
    }));
  }

  function get(id: string): ShoppingItem | null {
    const row = dz.select().from(shoppingItem).where(eq(shoppingItem.id, id)).get();
    return row ? assemble([row])[0]! : null;
  }

  /** The next free position: the end of the list, or 0 when it is empty. */
  function nextPosition(): number {
    const row = dz.select({ n: max(shoppingItem.position) }).from(shoppingItem).get();
    return row?.n === null || row?.n === undefined ? 0 : row.n + 1;
  }

  return {
    /** The whole list in position order. */
    list: (): ShoppingItem[] => assemble(dz.select().from(shoppingItem).orderBy(...order).all()),

    get,

    /**
     * Append lines to the end of the list, with their sources, in one
     * transaction. Merging is the caller's job (M31.2): this writes what it is
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
     * Absorb additions into an existing line (M31.2's `merges`): set its new
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
      const changed = dz
        .update(shoppingItem)
        .set({ ticked, updatedAt: nowUtc })
        .where(eq(shoppingItem.id, id))
        .returning({ id: shoppingItem.id })
        .all();
      return changed.length > 0 ? get(id) : null;
    },

    /** True when a row was deleted. Its sources cascade with it. */
    remove: (id: string): boolean =>
      dz.delete(shoppingItem).where(eq(shoppingItem.id, id)).returning({ id: shoppingItem.id }).all().length > 0,

    /** Delete every ticked line. Returns how many went. */
    clearTicked: (): number =>
      dz.delete(shoppingItem).where(eq(shoppingItem.ticked, true)).returning({ id: shoppingItem.id }).all().length,

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
      return assemble(dz.select().from(shoppingItem).orderBy(...order).all());
    },
  };
}

export type ShoppingRepository = ReturnType<typeof shopping>;
