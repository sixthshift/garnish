// Food repository. Server-only; pass the Database opened by openDatabase.
// Names are unique case-insensitively (NOCASE in 001_init.sql); creating a
// duplicate throws SQLite's UNIQUE error, findOrCreate returns the match.
import type { Database } from "bun:sqlite";
import { cleanName, likePattern } from "./names";

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

type Row = {
  id: string;
  name: string;
  plural_name: string | null;
  aliases: string;
  aisle_id: string | null;
  recipe_id: string | null;
  skip_shopping: 0 | 1;
};

const COLUMNS = "id, name, plural_name, aliases, aisle_id, recipe_id, skip_shopping";

function toFood(r: Row): Food {
  return {
    id: r.id,
    name: r.name,
    pluralName: r.plural_name,
    aliases: JSON.parse(r.aliases) as string[],
    aisleId: r.aisle_id,
    recipeId: r.recipe_id,
    skipShopping: r.skip_shopping === 1,
  };
}

export function foods(db: Database) {
  const selectAll = db.query<Row, []>(`SELECT ${COLUMNS} FROM food ORDER BY name`);
  const selectLike = db.query<Row, [string]>(`SELECT ${COLUMNS} FROM food WHERE name LIKE ? ESCAPE '\\' ORDER BY name`);
  const selectById = db.query<Row, [string]>(`SELECT ${COLUMNS} FROM food WHERE id = ?`);
  const selectByName = db.query<Row, [string]>(`SELECT ${COLUMNS} FROM food WHERE name = ?`);
  const insert = db.prepare(`INSERT INTO food (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const save = db.prepare(
    "UPDATE food SET name = ?, plural_name = ?, aliases = ?, aisle_id = ?, recipe_id = ?, skip_shopping = ? WHERE id = ?",
  );
  const del = db.prepare("DELETE FROM food WHERE id = ?");

  function get(id: string): Food | null {
    const row = selectById.get(id);
    return row ? toFood(row) : null;
  }

  function create(input: FoodInput): Food {
    const id = crypto.randomUUID();
    insert.run(
      id,
      cleanName(input.name),
      input.pluralName ?? null,
      JSON.stringify(input.aliases ?? []),
      input.aisleId ?? null,
      input.recipeId ?? null,
      input.skipShopping ? 1 : 0,
    );
    return get(id)!;
  }

  return {
    /** All foods by name, or those whose name contains `q` (case-insensitive). */
    list: (q?: string): Food[] => (q?.trim() ? selectLike.all(likePattern(q)) : selectAll.all()).map(toFood),
    get,
    create,

    /** Merge `patch` into the existing food. Null when `id` is unknown. */
    update(id: string, patch: Partial<Omit<Food, "id">>): Food | null {
      const current = get(id);
      if (!current) return null;
      const next = { ...current, ...patch, name: cleanName(patch.name ?? current.name) };
      save.run(
        next.name,
        next.pluralName,
        JSON.stringify(next.aliases),
        next.aisleId,
        next.recipeId,
        next.skipShopping ? 1 : 0,
        id,
      );
      return get(id);
    },

    /** True when a row was deleted. Ingredients pointing at it are set null by the schema. */
    remove: (id: string): boolean => del.run(id).changes > 0,

    /** Existing food whose name matches case-insensitively, else a new one. */
    findOrCreate(name: string): Food {
      const clean = cleanName(name);
      const row = selectByName.get(clean);
      return row ? toFood(row) : create({ name: clean });
    },
  };
}

export type FoodRepository = ReturnType<typeof foods>;
