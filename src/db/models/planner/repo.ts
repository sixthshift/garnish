import type { Database } from "bun:sqlite";
import { asc, eq, max } from "drizzle-orm";
import type { Meal } from "../../../domain/planner";
import { lazy } from "../../../lib/lazy";
import { getDb } from "../../../server/core/db";
import { orm } from "../../connection/client";
import { nowUtc } from "../columns";
import { plannerMeal, plannerRule } from "./schema";

export type PlannerRule = {
  id: string;
  position: number;
  text: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlannerRuleInput = { text: string; enabled?: boolean; position?: number };

export type PlannerMeal = { meal: Meal; enabled: boolean };

// Ties fall back to created_at so a list seeded in one transaction reads in the order it was written.
const order = [asc(plannerRule.position), asc(plannerRule.createdAt)];

/**
 * The planner guide and the meals a week is planned for. One factory for the
 * pair, because they are one setting screen and one read: the proposal asks
 * for both every time.
 */
export function plannerRepository(db: Database) {
  const dz = orm(db);

  function get(id: string): PlannerRule | null {
    return dz.select().from(plannerRule).where(eq(plannerRule.id, id)).get() ?? null;
  }

  function nextPosition(): number {
    const row = dz
      .select({ n: max(plannerRule.position) })
      .from(plannerRule)
      .get();
    return row?.n === null || row?.n === undefined ? 0 : row.n + 1;
  }

  const rules = {
    /** The whole guide in reading order. */
    list: (): PlannerRule[] =>
      dz
        .select()
        .from(plannerRule)
        .orderBy(...order)
        .all(),
    get,

    /** New statements go to the foot of the list unless a position is given, and are on unless told otherwise. */
    create(input: PlannerRuleInput): PlannerRule {
      const id = crypto.randomUUID();
      dz.insert(plannerRule)
        .values({
          id,
          position: input.position ?? nextPosition(),
          text: input.text.trim(),
          enabled: input.enabled ?? true,
        })
        .run();
      return get(id)!;
    },

    /** Merge `patch` into the statement and stamp `updated_at`. Null when `id` is unknown. */
    update(id: string, patch: Partial<PlannerRuleInput>): PlannerRule | null {
      const current = get(id);
      if (!current) return null;
      dz.update(plannerRule)
        .set({
          position: patch.position ?? current.position,
          text: patch.text === undefined ? current.text : patch.text.trim(),
          enabled: patch.enabled ?? current.enabled,
          updatedAt: nowUtc,
        })
        .where(eq(plannerRule.id, id))
        .run();
      return get(id);
    },

    /** True when a row was deleted. Nothing references a statement, so it goes alone. */
    remove: (id: string): boolean => dz.delete(plannerRule).where(eq(plannerRule.id, id)).returning({ id: plannerRule.id }).all().length > 0,

    /**
     * Set every statement's position to its index in `ids`, in one transaction —
     * the reorder control always sends the full order. An id that is not a real
     * statement is a no-op UPDATE for that one. Returns the guide afterwards, in
     * the new order. `updated_at` does not move: a reorder changes the guide, not
     * the statement.
     */
    reorder(ids: readonly string[]): PlannerRule[] {
      dz.transaction((tx) => {
        ids.forEach((id, index) => {
          tx.update(plannerRule).set({ position: index }).where(eq(plannerRule.id, id)).run();
        });
      });
      return dz
        .select()
        .from(plannerRule)
        .orderBy(...order)
        .all();
    },
  };

  const meals = {
    /** The three rows the migration seeded, in the order a day eats them. */
    list: (): PlannerMeal[] => dz.select().from(plannerMeal).orderBy(asc(plannerMeal.meal)).all().sort(byMealOrder),

    /**
     * Turn the given meals on or off, in one transaction, and answer all three
     * afterwards. A meal the migration did not seed is inserted rather than
     * lost, so the three rows are always there.
     */
    set(changes: readonly PlannerMeal[]): PlannerMeal[] {
      dz.transaction((tx) => {
        for (const change of changes) {
          tx.insert(plannerMeal)
            .values({ meal: change.meal, enabled: change.enabled })
            .onConflictDoUpdate({ target: plannerMeal.meal, set: { enabled: change.enabled } })
            .run();
        }
      });
      return meals.list();
    },
  };

  return { rules, meals };
}

// breakfast, lunch, dinner rather than the alphabet.
const MEAL_ORDER: Record<Meal, number> = { breakfast: 0, lunch: 1, dinner: 2 };
const byMealOrder = (a: PlannerMeal, b: PlannerMeal) => MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal];

export type PlannerRepository = ReturnType<typeof plannerRepository>;

/** The repository over the application database. Tests build their own with `plannerRepository(db)`. */
export default lazy(getDb, plannerRepository);
