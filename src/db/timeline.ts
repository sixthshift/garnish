// Timeline repository: the "Made this" log (decisions.md row 41). Server-only;
// pass the Database opened by openDatabase.
//
// `occurred_on` is a calendar date (YYYY-MM-DD) because a cook happened on a
// day. `recipe.last_made` stays the ISO timestamp the document already exposes
// and is derived from the events: it is midnight UTC of the greatest
// `occurred_on`, recomputed on every create and remove, and null when the
// recipe has no events left.
import type { Database } from "bun:sqlite";
import type { TimelineEvent, TimelineEventInput } from "../domain/recipe";

type Row = {
  id: string;
  recipe_id: string;
  occurred_on: string;
  message: string;
  image: string | null;
  created_at: string;
};

const COLUMNS = "id, recipe_id, occurred_on, message, image, created_at";

/** Midnight UTC of a YYYY-MM-DD date, in the timestamp format recipe rows use. */
export function lastMadeFrom(occurredOn: string | null): string | null {
  return occurredOn === null ? null : `${occurredOn}T00:00:00.000Z`;
}

function toEvent(r: Row): TimelineEvent {
  return {
    id: r.id,
    recipeId: r.recipe_id,
    occurredOn: r.occurred_on,
    message: r.message,
    image: r.image,
    createdAt: r.created_at,
  };
}

export function timeline(db: Database) {
  // Newest cook first; created_at breaks ties within a day.
  const selectByRecipe = db.query<Row, [string]>(
    `SELECT ${COLUMNS} FROM timeline_event WHERE recipe_id = ? ORDER BY occurred_on DESC, created_at DESC`,
  );
  const selectById = db.query<Row, [string]>(`SELECT ${COLUMNS} FROM timeline_event WHERE id = ?`);
  const selectMax = db.query<{ latest: string | null }, [string]>(
    "SELECT max(occurred_on) AS latest FROM timeline_event WHERE recipe_id = ?",
  );
  const insert = db.prepare(
    "INSERT INTO timeline_event (id, recipe_id, occurred_on, message, image) VALUES (?, ?, ?, ?, ?)",
  );
  const del = db.prepare("DELETE FROM timeline_event WHERE id = ?");
  const updateImage = db.prepare("UPDATE timeline_event SET image = ? WHERE id = ?");
  const setLastMade = db.prepare("UPDATE recipe SET last_made = ? WHERE id = ?");

  function get(id: string): TimelineEvent | null {
    const row = selectById.get(id);
    return row ? toEvent(row) : null;
  }

  /** Point recipe.last_made at the recipe's latest event, or null when it has none. */
  function recompute(recipeId: string): void {
    setLastMade.run(lastMadeFrom(selectMax.get(recipeId)?.latest ?? null), recipeId);
  }

  const createTx = db.transaction((recipeId: string, input: TimelineEventInput): string => {
    const id = crypto.randomUUID();
    insert.run(id, recipeId, input.occurredOn, input.message, input.image);
    recompute(recipeId);
    return id;
  });

  const removeTx = db.transaction((id: string): boolean => {
    const row = selectById.get(id);
    if (!row) return false;
    del.run(id);
    recompute(row.recipe_id);
    return true;
  });

  return {
    /** A recipe's events, newest first. */
    list: (recipeId: string): TimelineEvent[] => selectByRecipe.all(recipeId).map(toEvent),

    get,

    /** Log a cook and pull recipe.last_made up to the recipe's latest date. */
    create(recipeId: string, input: TimelineEventInput): TimelineEvent {
      return get(createTx(recipeId, input))!;
    },

    /** Point an event at a stored photo file name (or clear it). True when the event exists. */
    setImage(id: string, image: string | null): boolean {
      if (!selectById.get(id)) return false;
      updateImage.run(image, id);
      return true;
    },

    /** Delete an event and recompute recipe.last_made. True when a row went. */
    remove: (id: string): boolean => removeTx(id),

    recompute,
  };
}

export type TimelineRepository = ReturnType<typeof timeline>;
