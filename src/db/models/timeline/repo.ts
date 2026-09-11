// Timeline repository: the "Made this" log (decisions.md row 41). Server-only;
// pass the Database opened by openDatabase.
//
// `occurred_on` is a calendar date (YYYY-MM-DD) because a cook happened on a
// day. `recipe.last_made` stays the ISO timestamp the document already exposes
// and is derived from the events: it is midnight UTC of the greatest
// `occurred_on`, recomputed on every create and remove, and null when the
// recipe has no events left.
import type { Database } from "bun:sqlite";
import { desc, eq, max } from "drizzle-orm";
import type { TimelineEvent, TimelineEventInput } from "../../../domain/recipe";
import { type Executor, orm } from "../../connection/client";
import { recipe } from "../recipe/schema";
import { timelineEvent } from "./schema";

/** Midnight UTC of a YYYY-MM-DD date, in the timestamp format recipe rows use. */
export function lastMadeFrom(occurredOn: string | null): string | null {
  return occurredOn === null ? null : `${occurredOn}T00:00:00.000Z`;
}

export function timeline(db: Database) {
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
    on
      .update(recipe)
      .set({ lastMade: lastMadeFrom(latest?.latest ?? null) })
      .where(eq(recipe.id, recipeId))
      .run();
  }

  return {
    /** A recipe's events, newest first; created_at breaks ties within a day. */
    list: (recipeId: string): TimelineEvent[] =>
      dz
        .select()
        .from(timelineEvent)
        .where(eq(timelineEvent.recipeId, recipeId))
        .orderBy(desc(timelineEvent.occurredOn), desc(timelineEvent.createdAt))
        .all(),

    get,

    /** Log a cook and pull recipe.last_made up to the recipe's latest date. */
    create(recipeId: string, input: TimelineEventInput): TimelineEvent {
      const id = crypto.randomUUID();
      dz.transaction((tx) => {
        tx.insert(timelineEvent)
          .values({ id, recipeId, occurredOn: input.occurredOn, message: input.message, image: input.image })
          .run();
        recompute(recipeId, tx);
      });
      return get(id)!;
    },

    /** Point an event at a stored photo file name (or clear it). True when the event exists. */
    setImage(id: string, image: string | null): boolean {
      return (
        dz.update(timelineEvent).set({ image }).where(eq(timelineEvent.id, id)).returning({ id: timelineEvent.id })
          .all().length > 0
      );
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

export type TimelineRepository = ReturnType<typeof timeline>;
