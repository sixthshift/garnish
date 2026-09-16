import type { Database } from "bun:sqlite";
import { desc, eq, max } from "drizzle-orm";
import type { TimelineEvent, TimelineEventInput } from "../../../domain/recipe";
import { lazy } from "../../../lib/lazy";
import { getDb } from "../../../server/core/db";
import { type Executor, orm } from "../../connection/client";
import { recipe } from "../recipe/schema";
import { timelineEvent } from "./schema";

/** Midnight UTC of a YYYY-MM-DD date, in the timestamp format recipe rows use. */
export function lastMadeFrom(occurredOn: string | null): string | null {
  return occurredOn === null ? null : `${occurredOn}T00:00:00.000Z`;
}

export function timelineRepository(db: Database) {
  const dz = orm(db);

  function get(id: string): TimelineEvent | null {
    return dz.select().from(timelineEvent).where(eq(timelineEvent.id, id)).get() ?? null;
  }

  /** Point recipe.last_made at the recipe's latest event, or null when it has none. */
  function recompute(recipeId: string, on: Executor = dz): void {
    const latest = on
      .select({ latest: max(timelineEvent.occurredOn) })
      .from(timelineEvent)
      .where(eq(timelineEvent.recipeId, recipeId))
      .get();
    on.update(recipe)
      .set({ lastMade: lastMadeFrom(latest?.latest ?? null) })
      .where(eq(recipe.id, recipeId))
      .run();
  }

  return {
    /** A recipe's events, newest first; created_at breaks ties within a day. */
    list: (recipeId: string): TimelineEvent[] =>
      dz.select().from(timelineEvent).where(eq(timelineEvent.recipeId, recipeId)).orderBy(desc(timelineEvent.occurredOn), desc(timelineEvent.createdAt)).all(),

    get,

    /** Log a cook and pull recipe.last_made up to the recipe's latest date. */
    create(recipeId: string, input: TimelineEventInput): TimelineEvent {
      const id = crypto.randomUUID();
      dz.transaction((tx) => {
        tx.insert(timelineEvent)
          .values({
            id,
            recipeId,
            occurredOn: input.occurredOn,
            message: input.message,
            image: input.image,
            servings: input.servings,
          })
          .run();
        recompute(recipeId, tx);
      });
      return get(id)!;
    },

    /** Point an event at a stored photo file name (or clear it). True when the event exists. */
    setImage(id: string, image: string | null): boolean {
      return dz.update(timelineEvent).set({ image }).where(eq(timelineEvent.id, id)).returning({ id: timelineEvent.id }).all().length > 0;
    },

    /** Delete an event and recompute recipe.last_made. True when a row went. */
    remove(id: string): boolean {
      const existing = get(id);
      if (!existing) return false;
      dz.transaction((tx) => {
        tx.delete(timelineEvent).where(eq(timelineEvent.id, id)).run();
        recompute(existing.recipeId, tx);
      });
      return true;
    },

    recompute,
  };
}

export type TimelineRepository = ReturnType<typeof timelineRepository>;

/** The repository over the application database. Tests build their own with `timelineRepository(db)`. */
export default lazy(getDb, timelineRepository);
