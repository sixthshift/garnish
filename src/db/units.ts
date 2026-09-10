// Unit repository. Server-only. Names unique case-insensitively (NOCASE).
import type { Database } from "bun:sqlite";
import { cleanName, likePattern } from "./names";

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

type Row = {
  id: string;
  name: string;
  plural_name: string | null;
  abbreviation: string;
  use_abbreviation: 0 | 1;
  fraction: 0 | 1;
  standard_quantity: number | null;
  standard_unit_id: string | null;
};

const COLUMNS = "id, name, plural_name, abbreviation, use_abbreviation, fraction, standard_quantity, standard_unit_id";

function toUnit(r: Row): Unit {
  return {
    id: r.id,
    name: r.name,
    pluralName: r.plural_name,
    abbreviation: r.abbreviation,
    useAbbreviation: r.use_abbreviation === 1,
    fraction: r.fraction === 1,
    standardQuantity: r.standard_quantity,
    standardUnitId: r.standard_unit_id,
  };
}

export function units(db: Database) {
  const selectAll = db.query<Row, []>(`SELECT ${COLUMNS} FROM unit ORDER BY name`);
  const selectLike = db.query<Row, [string]>(`SELECT ${COLUMNS} FROM unit WHERE name LIKE ? ESCAPE '\\' ORDER BY name`);
  const selectById = db.query<Row, [string]>(`SELECT ${COLUMNS} FROM unit WHERE id = ?`);
  const selectByName = db.query<Row, [string]>(`SELECT ${COLUMNS} FROM unit WHERE name = ?`);
  const insert = db.prepare(`INSERT INTO unit (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const save = db.prepare(
    "UPDATE unit SET name = ?, plural_name = ?, abbreviation = ?, use_abbreviation = ?, fraction = ?, standard_quantity = ?, standard_unit_id = ? WHERE id = ?",
  );
  const del = db.prepare("DELETE FROM unit WHERE id = ?");

  function get(id: string): Unit | null {
    const row = selectById.get(id);
    return row ? toUnit(row) : null;
  }

  function create(input: UnitInput): Unit {
    const id = crypto.randomUUID();
    insert.run(
      id,
      cleanName(input.name),
      input.pluralName ?? null,
      input.abbreviation ?? "",
      input.useAbbreviation ? 1 : 0,
      (input.fraction ?? true) ? 1 : 0,
      input.standardQuantity ?? null,
      input.standardUnitId ?? null,
    );
    return get(id)!;
  }

  return {
    /** All units by name, or those whose name contains `q` (case-insensitive). */
    list: (q?: string): Unit[] => (q?.trim() ? selectLike.all(likePattern(q)) : selectAll.all()).map(toUnit),
    get,
    create,

    /** Merge `patch` into the existing unit. Null when `id` is unknown. */
    update(id: string, patch: Partial<Omit<Unit, "id">>): Unit | null {
      const current = get(id);
      if (!current) return null;
      const next = { ...current, ...patch, name: cleanName(patch.name ?? current.name) };
      save.run(
        next.name,
        next.pluralName,
        next.abbreviation,
        next.useAbbreviation ? 1 : 0,
        next.fraction ? 1 : 0,
        next.standardQuantity,
        next.standardUnitId,
        id,
      );
      return get(id);
    },

    /** True when a row was deleted. Ingredient and recipe references are set null by the schema. */
    remove: (id: string): boolean => del.run(id).changes > 0,

    /** Existing unit whose name matches case-insensitively, else a new one. */
    findOrCreate(name: string): Unit {
      const clean = cleanName(name);
      const row = selectByName.get(clean);
      return row ? toUnit(row) : create({ name: clean });
    },
  };
}

export type UnitRepository = ReturnType<typeof units>;
