// A line's alternatives as stored (decisions.md row 199): read by line, and
// written with the rest of the recipe. The backup reads and writes them too.

import { asc, inArray } from "drizzle-orm";
import type { Executor } from "../../connection/client";
import { alternative, alternativeItem } from "./schema";

/** An alternative as stored: ids, not documents. */
export type StoredAlternative = {
  basisQuantity: number | null;
  basisUnitId: string | null;
  note: string;
  planPicks: boolean;
  items: { foodId: string; quantity: number | null; unitId: string | null }[];
};

/** Every alternative these lines have, by ingredient id, in order; each with its items in theirs. */
export function readAlternatives(dz: Executor, ingredientIds: readonly string[]): Map<string, StoredAlternative[]> {
  const byLine = new Map<string, StoredAlternative[]>();
  if (ingredientIds.length === 0) return byLine;
  const rows = dz
    .select()
    .from(alternative)
    .where(inArray(alternative.ingredientId, [...ingredientIds]))
    .orderBy(asc(alternative.position))
    .all();
  if (rows.length === 0) return byLine;
  const items = dz
    .select()
    .from(alternativeItem)
    .where(
      inArray(
        alternativeItem.alternativeId,
        rows.map((row) => row.id)
      )
    )
    .orderBy(asc(alternativeItem.position))
    .all();
  const itemsOf = new Map<string, StoredAlternative["items"]>();
  for (const item of items) {
    const list = itemsOf.get(item.alternativeId) ?? [];
    list.push({ foodId: item.foodId, quantity: item.quantity, unitId: item.unitId });
    itemsOf.set(item.alternativeId, list);
  }
  for (const row of rows) {
    const list = byLine.get(row.ingredientId) ?? [];
    list.push({ basisQuantity: row.basisQuantity, basisUnitId: row.basisUnitId, note: row.note, planPicks: row.planPicks, items: itemsOf.get(row.id) ?? [] });
    byLine.set(row.ingredientId, list);
  }
  return byLine;
}

/**
 * Add `next` to this line's alternatives, positions from array order. The
 * caller clears the old ones first, as the recipe's parts cascade does. One
 * with no items is skipped, and so is one the plan picks that is not a single
 * food: the plan's choice names one food.
 */
export function insertAlternatives(tx: Executor, ingredientId: string, next: readonly StoredAlternative[]): void {
  let position = 0;
  for (const input of next) {
    if (input.items.length === 0) continue;
    const id = crypto.randomUUID();
    tx.insert(alternative)
      .values({
        id,
        ingredientId,
        position: position++,
        basisQuantity: input.basisQuantity,
        basisUnitId: input.basisUnitId,
        note: input.note,
        planPicks: input.planPicks && input.items.length === 1,
      })
      .run();
    tx.insert(alternativeItem)
      .values(
        input.items.map((item, i) => ({
          id: crypto.randomUUID(),
          alternativeId: id,
          position: i,
          foodId: item.foodId,
          quantity: item.quantity,
          unitId: item.unitId,
        }))
      )
      .run();
  }
}
