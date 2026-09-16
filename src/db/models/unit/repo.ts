import type { Database } from "bun:sqlite";
import { asc, eq, sql } from "drizzle-orm";
import { lazy } from "../../../lib/lazy";
import { cleanName, likePattern } from "../../../lib/names";
import { getDb } from "../../../server/core/db";
import { orm } from "../../connection/client";
import { ingredient, recipe } from "../recipe/schema";
import { unit } from "./schema";

export type Unit = {
  id: string;
  name: string;
  pluralName: string | null;
  abbreviation: string;
  useAbbreviation: boolean;
  fraction: boolean;
  standardQuantity: number | null;
  standardUnitId: string | null;
};

export type UnitInput = Partial<Omit<Unit, "id">> & { name: string };

export function unitRepository(db: Database) {
  const dz = orm(db);

  function get(id: string): Unit | null {
    return dz.select().from(unit).where(eq(unit.id, id)).get() ?? null;
  }

  function create(input: UnitInput): Unit {
    const id = crypto.randomUUID();
    dz.insert(unit)
      .values({
        id,
        name: cleanName(input.name),
        pluralName: input.pluralName ?? null,
        abbreviation: input.abbreviation ?? "",
        useAbbreviation: input.useAbbreviation ?? false,
        fraction: input.fraction ?? true,
        standardQuantity: input.standardQuantity ?? null,
        standardUnitId: input.standardUnitId ?? null,
      })
      .run();
    return get(id)!;
  }

  /** The unit with exactly this name, matched case-insensitively by the column's collation. */
  function getByName(name: string): Unit | null {
    return dz.select().from(unit).where(eq(unit.name, name.trim())).get() ?? null;
  }

  return {
    /** All units by name, or those whose name contains `q` (case-insensitive). */
    list(q?: string): Unit[] {
      const query = dz.select().from(unit);
      return q?.trim()
        ? query
            .where(sql`${unit.name} LIKE ${likePattern(q)} ESCAPE '\\'`)
            .orderBy(asc(unit.name))
            .all()
        : query.orderBy(asc(unit.name)).all();
    },
    get,
    getByName,
    create,

    /** Merge `patch` into the existing unit. Null when `id` is unknown. */
    update(id: string, patch: Partial<Omit<Unit, "id">>): Unit | null {
      const current = get(id);
      if (!current) return null;
      const { id: _id, ...next } = { ...current, ...patch, name: cleanName(patch.name ?? current.name) };
      dz.update(unit).set(next).where(eq(unit.id, id)).run();
      return get(id);
    },

    /** True when a row was deleted. Ingredient and recipe references are set null by the schema. */
    remove: (id: string): boolean => dz.delete(unit).where(eq(unit.id, id)).returning({ id: unit.id }).all().length > 0,

    /** Existing unit whose name matches case-insensitively, else a new one. */
    findOrCreate(name: string): Unit {
      const clean = cleanName(name);
      return getByName(clean) ?? create({ name: clean });
    },

    /**
     * Repoint every ingredient and recipe yield using `sourceId` to
     * `targetId`, then delete the source, in one transaction. Returns the
     * target, or null when either id is unknown. Merging a unit into itself
     * is a no-op that returns it. A unit that used the source as its
     * `standardUnitId` conversion base is left to the schema's ON DELETE SET
     * NULL, same as a plain delete.
     */
    merge(sourceId: string, targetId: string): Unit | null {
      if (sourceId === targetId) return get(targetId);
      const target = get(targetId);
      if (!target || !get(sourceId)) return null;
      dz.transaction((tx) => {
        tx.update(ingredient).set({ unitId: targetId }).where(eq(ingredient.unitId, sourceId)).run();
        tx.update(recipe).set({ yieldUnitId: targetId }).where(eq(recipe.yieldUnitId, sourceId)).run();
        tx.delete(unit).where(eq(unit.id, sourceId)).run();
      });
      return get(targetId);
    },
  };
}

export type UnitRepository = ReturnType<typeof unitRepository>;

/** The repository over the application database. Tests build their own with `unitRepository(db)`. */
export default lazy(getDb, unitRepository);
