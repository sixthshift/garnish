// Food repository. Server-only; pass the Database opened by openDatabase.
// Names are unique case-insensitively (NOCASE in 001_init.sql); creating a
// duplicate throws SQLite's UNIQUE error, findOrCreate returns the match.
import type { Database } from "bun:sqlite";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { orm } from "../../connection/client";
import { cleanName, likePattern } from "../../../domain/names";
import { ingredient } from "../recipe/schema";
import type { FoodConversion } from "../../../domain/recipe";
import { food, foodConversion } from "./schema";

export type Food = {
  id: string;
  name: string;
  pluralName: string | null;
  aliases: string[];
  aisleId: string | null;
  recipeId: string | null;
  skipShopping: boolean;
  /** "1 cup of flour is 125 g" (decisions.md row 69). Empty for most foods. */
  conversions: FoodConversion[];
};

export type FoodInput = Partial<Omit<Food, "id" | "conversions">> & { name: string; conversions?: readonly FoodConversionInput[] };

/** A conversion as it is written: the id is the repository's, the food's is the parent's. */
export type FoodConversionInput = Omit<FoodConversion, "id">;

export function foods(db: Database) {
  const dz = orm(db);

  /** Every conversion of these foods, keyed by food id, in insertion order. */
  function conversionsOf(foodIds: readonly string[]): Map<string, FoodConversion[]> {
    const byFood = new Map<string, FoodConversion[]>();
    if (foodIds.length === 0) return byFood;
    const rows = dz
      .select()
      .from(foodConversion)
      .where(inArray(foodConversion.foodId, [...foodIds]))
      .orderBy(sql`rowid`)
      .all();
    for (const row of rows) {
      const list = byFood.get(row.foodId) ?? [];
      list.push({ id: row.id, unitId: row.unitId, quantity: row.quantity, toUnitId: row.toUnitId, toQuantity: row.toQuantity });
      byFood.set(row.foodId, list);
    }
    return byFood;
  }

  /** Rows to documents: each food carries its own conversions. */
  function assemble(rows: (typeof food.$inferSelect)[]): Food[] {
    const byFood = conversionsOf(rows.map((r) => r.id));
    return rows.map((row) => ({ ...row, conversions: byFood.get(row.id) ?? [] }));
  }

  /** Replace this food's conversions with `next`, in one statement pair. */
  function writeConversions(foodId: string, next: readonly FoodConversionInput[]): void {
    dz.delete(foodConversion).where(eq(foodConversion.foodId, foodId)).run();
    if (next.length === 0) return;
    dz.insert(foodConversion)
      .values(
        next.map((row) => ({
          id: crypto.randomUUID(),
          foodId,
          unitId: row.unitId,
          quantity: row.quantity,
          toUnitId: row.toUnitId,
          toQuantity: row.toQuantity,
        })),
      )
      .run();
  }

  function get(id: string): Food | null {
    const row = dz.select().from(food).where(eq(food.id, id)).get();
    return row ? assemble([row])[0]! : null;
  }

  function create(input: FoodInput): Food {
    const id = crypto.randomUUID();
    dz.transaction((tx) => {
      tx.insert(food)
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
      if (input.conversions?.length) writeConversions(id, input.conversions);
    });
    return get(id)!;
  }

  /** The food with exactly this name, matched case-insensitively by the column's collation. */
  function getByName(name: string): Food | null {
    const row = dz.select().from(food).where(eq(food.name, name.trim())).get();
    return row ? assemble([row])[0]! : null;
  }

  return {
    /** All foods by name, or those whose name contains `q` (case-insensitive). */
    list(q?: string): Food[] {
      const query = dz.select().from(food);
      return assemble(
        q?.trim()
          ? query
              .where(sql`${food.name} LIKE ${likePattern(q)} ESCAPE '\\'`)
              .orderBy(asc(food.name))
              .all()
          : query.orderBy(asc(food.name)).all(),
      );
    },
    get,
    getByName,
    create,

    /** Merge `patch` into the existing food. Null when `id` is unknown. */
    update(id: string, patch: Partial<Omit<Food, "id" | "conversions">> & { conversions?: readonly FoodConversionInput[] }): Food | null {
      const current = get(id);
      if (!current) return null;
      const { conversions, ...fields } = patch;
      const { id: _id, conversions: _conversions, ...next } = { ...current, ...fields, name: cleanName(fields.name ?? current.name) };
      dz.transaction((tx) => {
        tx.update(food).set(next).where(eq(food.id, id)).run();
        if (conversions) writeConversions(id, conversions);
      });
      return get(id);
    },

    /** This food's conversions, replaced wholesale. Null when `id` is unknown. */
    setConversions(id: string, next: readonly FoodConversionInput[]): Food | null {
      if (!get(id)) return null;
      writeConversions(id, next);
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
