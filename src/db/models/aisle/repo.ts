import type { Database } from "bun:sqlite";
import { asc, eq, max, sql } from "drizzle-orm";
import { lazy } from "../../../lib/lazy";
import { cleanName, likePattern } from "../../../lib/names";
import { getDb } from "../../../server/core/db";
import { orm } from "../../connection/client";
import { aisle } from "./schema";

export type Aisle = {
  id: string;
  name: string;
  position: number;
};

export type AisleInput = Partial<Omit<Aisle, "id">> & { name: string };

const order = [asc(aisle.position), asc(aisle.name)];

export function aisles(db: Database) {
  const dz = orm(db);

  function get(id: string): Aisle | null {
    return dz.select().from(aisle).where(eq(aisle.id, id)).get() ?? null;
  }

  function nextPosition(): number {
    const row = dz
      .select({ n: max(aisle.position) })
      .from(aisle)
      .get();
    return row?.n === null || row?.n === undefined ? 0 : row.n + 1;
  }

  /** New aisles go to the end unless a position is given. */
  function create(input: AisleInput): Aisle {
    const id = crypto.randomUUID();
    dz.insert(aisle)
      .values({ id, name: cleanName(input.name), position: input.position ?? nextPosition() })
      .run();
    return get(id)!;
  }

  return {
    /** All aisles in position order, or those whose name contains `q` (case-insensitive). */
    list(q?: string): Aisle[] {
      const query = dz.select().from(aisle);
      // LIKE with an explicit ESCAPE: `likePattern` escapes % and _ with a
      // backslash, which SQLite only honours when the clause names it.
      return q?.trim()
        ? query
            .where(sql`${aisle.name} LIKE ${likePattern(q)} ESCAPE '\\'`)
            .orderBy(...order)
            .all()
        : query.orderBy(...order).all();
    },
    get,
    create,

    /** Merge `patch` into the existing aisle. Null when `id` is unknown. */
    update(id: string, patch: Partial<Omit<Aisle, "id">>): Aisle | null {
      const current = get(id);
      if (!current) return null;
      const next = { ...current, ...patch, name: cleanName(patch.name ?? current.name) };
      dz.update(aisle).set({ name: next.name, position: next.position }).where(eq(aisle.id, id)).run();
      return get(id);
    },

    /** True when a row was deleted. Foods in the aisle keep existing with aisle_id null. */
    remove: (id: string): boolean => dz.delete(aisle).where(eq(aisle.id, id)).returning({ id: aisle.id }).all().length > 0,

    /** Existing aisle whose name matches case-insensitively, else a new one at the end. */
    findOrCreate(name: string): Aisle {
      const clean = cleanName(name);
      return dz.select().from(aisle).where(eq(aisle.name, clean)).get() ?? create({ name: clean });
    },

    /**
     * Set every aisle's position to its index in `ids`, in one transaction —
     * the drag-reorder list always sends the full order. An id that is not a
     * real aisle is a no-op UPDATE for that one. Returns the list afterwards,
     * in the new position order.
     */
    reorder(ids: readonly string[]): Aisle[] {
      dz.transaction((tx) => {
        ids.forEach((id, index) => {
          tx.update(aisle).set({ position: index }).where(eq(aisle.id, id)).run();
        });
      });
      return dz
        .select()
        .from(aisle)
        .orderBy(...order)
        .all();
    },
  };
}

export type AisleRepository = ReturnType<typeof aisles>;

/** The repository over the application database. Tests build their own with `aisles(db)`. */
export default lazy(getDb, aisles);
