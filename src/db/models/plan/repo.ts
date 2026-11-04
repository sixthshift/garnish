import type { Database } from "bun:sqlite";
import { and, asc, eq, gte, inArray, lte, max, ne } from "drizzle-orm";
import { addDays, groupByDay, type ParsedPlanEntryInput, type PlanDay, type PlanEntry, type PlanEntryPatch, type PlanRecipe } from "../../../domain/plan/plan";
import { lazy } from "../../../lib/lazy";
import { getDb } from "../../../server/core/db";
import { orm } from "../../connection/client";
import { food } from "../food/schema";
import { alternative, alternativeItem, ingredient, part, recipe } from "../recipe/schema";
import { mealPlanEntry } from "./schema";

const order = [asc(mealPlanEntry.position), asc(mealPlanEntry.id)];

export function planRepository(db: Database) {
  const dz = orm(db);

  // --- Document assembly ---------------------------------------------------

  /** The summary fields of every recipe named by `rows`, in one select. */
  function readRecipes(rows: (typeof mealPlanEntry.$inferSelect)[]): Map<string, PlanRecipe> {
    const ids = [...new Set(rows.map((r) => r.recipeId).filter((id): id is string => id !== null))];
    if (ids.length === 0) return new Map();
    const found = dz.select({ id: recipe.id, slug: recipe.slug, name: recipe.name, image: recipe.image }).from(recipe).where(inArray(recipe.id, ids)).all();
    return new Map(found.map((r) => [r.id, r]));
  }

  /**
   * The names of the foods each entry's choices pick, in recipe order: only a
   * choice that is still one of its row's options, in that row's recipe,
   * counts (decisions.md row 198). A row on its own food names nothing.
   */
  function readChosen(rows: (typeof mealPlanEntry.$inferSelect)[]): Map<string, string[]> {
    const chosen = new Map<string, string[]>();
    const rowIds = [...new Set(rows.flatMap((row) => Object.keys(row.choices)))];
    if (rowIds.length === 0) return chosen;
    const options = dz
      .select({ ingredientId: alternative.ingredientId, foodId: alternativeItem.foodId, name: food.name, recipeId: part.recipeId })
      .from(alternative)
      .innerJoin(alternativeItem, eq(alternativeItem.alternativeId, alternative.id))
      .innerJoin(food, eq(food.id, alternativeItem.foodId))
      .innerJoin(ingredient, eq(ingredient.id, alternative.ingredientId))
      .innerJoin(part, eq(part.id, ingredient.partId))
      .where(and(inArray(alternative.ingredientId, rowIds), eq(alternative.planPicks, true)))
      .orderBy(asc(part.position), asc(ingredient.position))
      .all();
    for (const row of rows) {
      const names = options
        .filter((option) => option.recipeId === row.recipeId && row.choices[option.ingredientId] === option.foodId)
        .map((option) => option.name);
      if (names.length > 0) chosen.set(row.id, names);
    }
    return chosen;
  }

  /** The recipes among `rows` with a line that has an alternative the plan picks: the entries that have something to choose. */
  function readChoosable(rows: (typeof mealPlanEntry.$inferSelect)[]): Set<string> {
    const ids = [...new Set(rows.map((r) => r.recipeId).filter((id): id is string => id !== null))];
    if (ids.length === 0) return new Set();
    return new Set(
      dz
        .selectDistinct({ recipeId: part.recipeId })
        .from(alternative)
        .innerJoin(ingredient, eq(ingredient.id, alternative.ingredientId))
        .innerJoin(part, eq(part.id, ingredient.partId))
        .where(and(inArray(part.recipeId, ids), eq(alternative.planPicks, true)))
        .all()
        .map((row) => row.recipeId)
    );
  }

  function assemble(rows: (typeof mealPlanEntry.$inferSelect)[]): PlanEntry[] {
    if (rows.length === 0) return [];
    const recipes = readRecipes(rows);
    const chosen = readChosen(rows);
    const choosable = readChoosable(rows);
    return rows.map((row) => ({
      id: row.id,
      date: row.date,
      position: row.position,
      recipe: (row.recipeId && recipes.get(row.recipeId)) || null,
      text: row.text,
      servings: row.servings,
      meal: row.meal,
      choices: row.choices,
      chosen: chosen.get(row.id) ?? [],
      choosable: row.recipeId !== null && choosable.has(row.recipeId),
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
          meal: input.meal,
          choices: input.choices,
        })
        .run();
      return get(id)!;
    },

    /**
     * Append several entries in one transaction: an accepted proposal is a
     * week, and half a week written is worse than none (M39.4). Each lands at
     * the end of its own day, in the order given.
     */
    addMany(inputs: readonly ParsedPlanEntryInput[]): PlanEntry[] {
      const ids: string[] = [];
      dz.transaction((tx) => {
        for (const input of inputs) {
          const id = crypto.randomUUID();
          tx.insert(mealPlanEntry)
            .values({
              id,
              date: input.date,
              position: nextPosition(input.date),
              recipeId: input.recipeId,
              text: input.text,
              servings: input.servings,
              meal: input.meal,
              choices: input.choices,
            })
            .run();
          ids.push(id);
        }
      });
      return ids.map((id) => get(id)!);
    },

    /**
     * Merge `patch` into an entry. Null when `id` is unknown. The day and the
     * order are `move`'s business, so they are not in the patch.
     */
    /** The choices of every entry of this recipe, oldest first: what `rotateChoices` varies from (decisions.md row 198). */
    choicesOf(recipeId: string): Record<string, string>[] {
      return dz
        .select({ choices: mealPlanEntry.choices })
        .from(mealPlanEntry)
        .where(eq(mealPlanEntry.recipeId, recipeId))
        .orderBy(asc(mealPlanEntry.date), ...order)
        .all()
        .map((row) => row.choices);
    },

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

export type PlanRepository = ReturnType<typeof planRepository>;

/** The repository over the application database. Tests build their own with `planRepository(db)`. */
export default lazy(getDb, planRepository);
