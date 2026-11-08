import type { Database } from "bun:sqlite";
import { asc, eq, inArray, max, sql } from "drizzle-orm";
import type { ParsedShoppingItemInput, ShoppingItem, ShoppingItemSourceInput } from "../../../domain/shopping/shopping";
import { lazy } from "../../../lib/lazy";
import { getDb } from "../../../server/core/db";
import { orm } from "../../connection/client";
import { aisleRepository } from "../aisle/repo";
import { nowUtc } from "../columns";
import { foodRepository } from "../food/repo";
import { recipe } from "../recipe/schema";
import { referenceReader } from "../references";
import { unitRepository } from "../unit/repo";
import { shoppingItem, shoppingItemSource } from "./schema";

const order = [asc(shoppingItem.position), asc(shoppingItem.createdAt)];

export function shoppingRepository(db: Database) {
  const dz = orm(db);
  const units = unitRepository(db);
  const foods = foodRepository(db);
  const aisles = aisleRepository(db);

  // --- Document assembly ---------------------------------------------------

  /** Turn stored rows into documents: nested food and unit, sources under their line. */
  function assemble(rows: (typeof shoppingItem.$inferSelect)[]): ShoppingItem[] {
    if (rows.length === 0) return [];
    const refs = referenceReader({ units, foods, aisles });

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

    // The live recipes' slugs, for the row's link to each, and their photos, for a desktop's meals key; a deleted recipe has neither.
    const recipeIds = [...new Set(sourceRows.flatMap((s) => (s.recipeId === null ? [] : [s.recipeId])))];
    const live = new Map(
      recipeIds.length === 0
        ? []
        : dz
            .select({ id: recipe.id, slug: recipe.slug, image: recipe.image })
            .from(recipe)
            .where(inArray(recipe.id, recipeIds))
            .all()
            .map((row) => [row.id, row])
    );

    const sourcesByItem = new Map<string, ShoppingItem["sources"]>();
    for (const s of sourceRows) {
      const list = sourcesByItem.get(s.itemId) ?? [];
      list.push({
        id: s.id,
        recipeId: s.recipeId,
        recipeSlug: s.recipeId === null ? null : (live.get(s.recipeId)?.slug ?? null),
        recipeImage: s.recipeId === null ? null : (live.get(s.recipeId)?.image ?? null),
        recipeName: s.recipeName,
        partName: s.partName,
        servings: s.servings,
        quantity: s.quantity,
        unit: refs.unit(s.unitId),
        planDate: s.planDate,
      });
      sourcesByItem.set(s.itemId, list);
    }

    return rows.map((row) => ({
      id: row.id,
      position: row.position,
      quantity: row.quantity,
      unit: refs.unit(row.unitId),
      food: refs.food(row.foodId),
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

  /** The next free position: the end of the list, or 0 when it is empty. */
  function nextPosition(): number {
    const row = dz
      .select({ n: max(shoppingItem.position) })
      .from(shoppingItem)
      .get();
    return row?.n === null || row?.n === undefined ? 0 : row.n + 1;
  }

  return {
    list,
    get,
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
                unitId: source.unitId,
                planDate: source.planDate,
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
              unitId: source.unitId,
              planDate: source.planDate,
            })
            .run();
        }
      });
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
  };
}

export type ShoppingRepository = ReturnType<typeof shoppingRepository>;

/** The repository over the application database. Tests build their own with `shoppingRepository(db)`. */
export default lazy(getDb, shoppingRepository);
