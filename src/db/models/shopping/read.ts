import { asc, eq, inArray, sql } from "drizzle-orm";
import type { Food, Unit } from "../../../domain/reference";
import type { ShoppingItem } from "../../../domain/shopping";
import type { ShoppingContext } from "./context";
import { shoppingItem, shoppingItemSource } from "./schema";

const order = [asc(shoppingItem.position), asc(shoppingItem.createdAt)];

export type Readers = ReturnType<typeof readers>;

export function readers({ dz, units, foods, aisles }: ShoppingContext) {
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
          rows.map((r) => r.id)
        )
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

  /** The whole list in position order. */
  const list = (): ShoppingItem[] =>
    assemble(
      dz
        .select()
        .from(shoppingItem)
        .orderBy(...order)
        .all()
    );

  return { get, list };
}
