// Food repository. Server-only; pass the Database opened by openDatabase.
// Names are unique case-insensitively (NOCASE in 001_init.sql); creating a
// duplicate throws SQLite's UNIQUE error, findOrCreate returns the match.
import type { Database } from "bun:sqlite";
import { asc, eq, sql } from "drizzle-orm";
import { orm } from "../../connection/client";
import { cleanName, likePattern } from "../../../domain/names";
import { ingredient } from "../recipe/schema";
import { food } from "./schema";

export type Food = {
  id: string;
  name: string;
  pluralName: string | null;
  aliases: string[];
  aisleId: string | null;
  recipeId: string | null;
  skipShopping: boolean;
};

export type FoodInput = Partial<Omit<Food, "id">> & { name: string };

export function foods(db: Database) {
  const dz = orm(db);

  function get(id: string): Food | null {
    return dz.select().from(food).where(eq(food.id, id)).get() ?? null;
  }

  function create(input: FoodInput): Food {
    const id = crypto.randomUUID();
    dz.insert(food)
      .values({
        id,
        name: cleanName(input.name),
        pluralName: input.pluralName ?? null,
        aliases: input.aliases ?? [],
        aisleId: input.aisleId ?? null,
        recipeId: input.recipeId ?? null,
        skipShopping: input.skipShopping ?? false,
      })
      .run();
    return get(id)!;
  }

  /** The food with exactly this name, matched case-insensitively by the column's collation. */
  function getByName(name: string): Food | null {
    return dz.select().from(food).where(eq(food.name, name.trim())).get() ?? null;
  }

  return {
    /** All foods by name, or those whose name contains `q` (case-insensitive). */
    list(q?: string): Food[] {
      const query = dz.select().from(food);
      return q?.trim()
        ? query
            .where(sql`${food.name} LIKE ${likePattern(q)} ESCAPE '\\'`)
            .orderBy(asc(food.name))
            .all()
        : query.orderBy(asc(food.name)).all();
    },
    get,
    getByName,
    create,

    /** Merge `patch` into the existing food. Null when `id` is unknown. */
    update(id: string, patch: Partial<Omit<Food, "id">>): Food | null {
      const current = get(id);
      if (!current) return null;
      const { id: _id, ...next } = { ...current, ...patch, name: cleanName(patch.name ?? current.name) };
      dz.update(food).set(next).where(eq(food.id, id)).run();
      return get(id);
    },

    /** True when a row was deleted. Ingredients pointing at it are set null by the schema. */
    remove: (id: string): boolean => dz.delete(food).where(eq(food.id, id)).returning({ id: food.id }).all().length > 0,

    /** Existing food whose name matches case-insensitively, else a new one. */
    findOrCreate(name: string): Food {
      const clean = cleanName(name);
      return getByName(clean) ?? create({ name: clean });
    },

    /**
     * Repoint every ingredient using `sourceId` to `targetId`, then delete the
     * source, in one transaction. Returns the target, or null when either id
     * is unknown. Merging a food into itself is a no-op that returns it.
     */
    merge(sourceId: string, targetId: string): Food | null {
      if (sourceId === targetId) return get(targetId);
      const target = get(targetId);
      if (!target || !get(sourceId)) return null;
      dz.transaction((tx) => {
        tx.update(ingredient).set({ foodId: targetId }).where(eq(ingredient.foodId, sourceId)).run();
        tx.delete(food).where(eq(food.id, sourceId)).run();
      });
      return get(targetId);
    },
  };
}

export type FoodRepository = ReturnType<typeof foods>;
