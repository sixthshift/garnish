// Aisle repository (Mealie's shopping labels). Server-only. Names unique
// case-insensitively; listed in position order for the shopping list.
import type { Database } from "bun:sqlite";
import { cleanName, likePattern } from "./names";

export type Aisle = {
  id: string;
  name: string;
  position: number;
};

export type AisleInput = Partial<Omit<Aisle, "id">> & { name: string };

type Row = { id: string; name: string; position: number };

const COLUMNS = "id, name, position";

export function aisles(db: Database) {
  const selectAll = db.query<Row, []>(`SELECT ${COLUMNS} FROM aisle ORDER BY position, name`);
  const selectLike = db.query<Row, [string]>(`SELECT ${COLUMNS} FROM aisle WHERE name LIKE ? ESCAPE '\\' ORDER BY position, name`);
  const selectById = db.query<Row, [string]>(`SELECT ${COLUMNS} FROM aisle WHERE id = ?`);
  const selectByName = db.query<Row, [string]>(`SELECT ${COLUMNS} FROM aisle WHERE name = ?`);
  const nextPosition = db.query<{ n: number }, []>("SELECT coalesce(max(position) + 1, 0) AS n FROM aisle");
  const insert = db.prepare(`INSERT INTO aisle (${COLUMNS}) VALUES (?, ?, ?)`);
  const save = db.prepare("UPDATE aisle SET name = ?, position = ? WHERE id = ?");
  const del = db.prepare("DELETE FROM aisle WHERE id = ?");
  const setPosition = db.prepare("UPDATE aisle SET position = ? WHERE id = ?");

  function get(id: string): Aisle | null {
    return selectById.get(id) ?? null;
  }

  /** New aisles go to the end unless a position is given. */
  function create(input: AisleInput): Aisle {
    const id = crypto.randomUUID();
    insert.run(id, cleanName(input.name), input.position ?? nextPosition.get()!.n);
    return get(id)!;
  }

  return {
    /** All aisles in position order, or those whose name contains `q` (case-insensitive). */
    list: (q?: string): Aisle[] => (q?.trim() ? selectLike.all(likePattern(q)) : selectAll.all()),
    get,
    create,

    /** Merge `patch` into the existing aisle. Null when `id` is unknown. */
    update(id: string, patch: Partial<Omit<Aisle, "id">>): Aisle | null {
      const current = get(id);
      if (!current) return null;
      const next = { ...current, ...patch, name: cleanName(patch.name ?? current.name) };
      save.run(next.name, next.position, id);
      return get(id);
    },

    /** True when a row was deleted. Foods in the aisle keep existing with aisle_id null. */
    remove: (id: string): boolean => del.run(id).changes > 0,

    /** Existing aisle whose name matches case-insensitively, else a new one at the end. */
    findOrCreate(name: string): Aisle {
      const clean = cleanName(name);
      return selectByName.get(clean) ?? create({ name: clean });
    },

    /**
     * Set every aisle's position to its index in `ids`, in one transaction —
     * the drag-reorder list always sends the full order. An id that is not a
     * real aisle is a no-op UPDATE for that one. Returns the list afterwards,
     * in the new position order.
     */
    reorder(ids: readonly string[]): Aisle[] {
      const reorderTx = db.transaction(() => {
        ids.forEach((id, index) => setPosition.run(index, id));
      });
      reorderTx();
      return selectAll.all();
    },
  };
}

export type AisleRepository = ReturnType<typeof aisles>;
