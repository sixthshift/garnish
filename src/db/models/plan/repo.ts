import type { Database } from "bun:sqlite";
import { and, asc, eq, gte, inArray, lte, max, ne } from "drizzle-orm";
import { addDays, groupByDay, type ParsedPlanEntryInput, type PlanDay, type PlanEntry, type PlanEntryPatch, type PlanRecipe } from "../../../domain/plan";
import { lazy } from "../../../lib/lazy";
import { getDb } from "../../../server/core/db";
import { orm } from "../../connection/client";
import { recipe } from "../recipe/schema";
import { mealPlanEntry } from "./schema";

const order = [asc(mealPlanEntry.position), asc(mealPlanEntry.id)];

export function plan(db: Database) {
  const dz = orm(db);

  // --- Document assembly ---------------------------------------------------

  /** The summary fields of every recipe named by `rows`, in one select. */
  function readRecipes(rows: (typeof mealPlanEntry.$inferSelect)[]): Map<string, PlanRecipe> {
    const ids = [...new Set(rows.map((r) => r.recipeId).filter((id): id is string => id !== null))];
    if (ids.length === 0) return new Map();
    const found = dz.select({ id: recipe.id, slug: recipe.slug, name: recipe.name, image: recipe.image }).from(recipe).where(inArray(recipe.id, ids)).all();
    return new Map(found.map((r) => [r.id, r]));
  }

  function assemble(rows: (typeof mealPlanEntry.$inferSelect)[]): PlanEntry[] {
    if (rows.length === 0) return [];
    const recipes = readRecipes(rows);
    return rows.map((row) => ({
      id: row.id,
      date: row.date,
      position: row.position,
      recipe: (row.recipeId && recipes.get(row.recipeId)) || null,
      text: row.text,
      servings: row.servings,
    }));
  }

  function get(id: string): PlanEntry | null {
    const row = dz.select().from(mealPlanEntry).where(eq(mealPlanEntry.id, id)).get();
    return row ? assemble([row])[0]! : null;
  }

  /** The next free position on `date`: the end of that day, or 0 when it is empty. */
  function nextPosition(date: string): number {
    const row = dz
      .select({ n: max(mealPlanEntry.position) })
      .from(mealPlanEntry)
      .where(eq(mealPlanEntry.date, date))
      .get();
    return row?.n === null || row?.n === undefined ? 0 : row.n + 1;
  }

  /** One day's entry ids in order, optionally leaving one out. */
  function dayIds(date: string, except?: string): string[] {
    const where = except ? and(eq(mealPlanEntry.date, date), ne(mealPlanEntry.id, except)) : eq(mealPlanEntry.date, date);
    return dz
      .select({ id: mealPlanEntry.id })
      .from(mealPlanEntry)
      .where(where)
      .orderBy(...order)
      .all()
      .map((r) => r.id);
  }

  return {
    /**
     * The seven days beginning `monday`, each with its entries in position
     * order. Days with nothing on them are present and empty: the week strip
     * draws Monday to Sunday either way.
     */
    week(monday: string): PlanDay[] {
      const rows = dz
        .select()
        .from(mealPlanEntry)
        .where(and(gte(mealPlanEntry.date, monday), lte(mealPlanEntry.date, addDays(monday, 6))))
        .orderBy(asc(mealPlanEntry.date), ...order)
        .all();
      return groupByDay(monday, assemble(rows));
    },

    get,

    /** Append an entry to the end of its day. */
    add(input: ParsedPlanEntryInput): PlanEntry {
      const id = crypto.randomUUID();
      dz.insert(mealPlanEntry)
        .values({
          id,
          date: input.date,
          position: nextPosition(input.date),
          recipeId: input.recipeId,
          text: input.text,
          servings: input.servings,
        })
        .run();
      return get(id)!;
    },

    /**
     * Merge `patch` into an entry. Null when `id` is unknown. The day and the
     * order are `move`'s business, so they are not in the patch.
     */
    update(id: string, patch: PlanEntryPatch): PlanEntry | null {
      if (!get(id)) return null;
      if (Object.keys(patch).length > 0) {
        dz.update(mealPlanEntry).set(patch).where(eq(mealPlanEntry.id, id)).run();
      }
      return get(id);
    },

    /**
     * Put an entry on `date` at `position`, renumbering both days in one
     * transaction: the day it left closes the gap, the day it joins opens one.
     * A position past the end of the day lands at the end. Null when `id` is
     * unknown.
     */
    move(id: string, date: string, position: number): PlanEntry | null {
      const entry = get(id);
      if (!entry) return null;
      const from = entry.date;
      dz.transaction((tx) => {
        const write = (ids: readonly string[]) =>
          ids.forEach((rowId, index) => {
            tx.update(mealPlanEntry).set({ position: index }).where(eq(mealPlanEntry.id, rowId)).run();
          });

        const target = dayIds(date, id);
        const at = Math.max(0, Math.min(Math.trunc(position), target.length));
        target.splice(at, 0, id);

        tx.update(mealPlanEntry).set({ date }).where(eq(mealPlanEntry.id, id)).run();
        if (from !== date) write(dayIds(from, id));
        write(target);
      });
      return get(id);
    },

    /** True when a row was deleted. */
    remove: (id: string): boolean => dz.delete(mealPlanEntry).where(eq(mealPlanEntry.id, id)).returning({ id: mealPlanEntry.id }).all().length > 0,
  };
}

export type PlanRepository = ReturnType<typeof plan>;

/** The repository over the application database. Tests build their own with `plan(db)`. */
export default lazy(getDb, plan);
