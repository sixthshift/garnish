// Tag repository. Server-only. Names unique case-insensitively; the slug is
// derived from the name (Mealie) and de-duplicated with a numeric suffix.
import type { Database } from "bun:sqlite";
import { cleanName, slugify, uniqueSlug } from "./names";

export type Tag = {
  id: string;
  name: string;
  slug: string;
};

export type TagInput = { name: string };

type Row = { id: string; name: string; slug: string };

const COLUMNS = "id, name, slug";

export function tags(db: Database) {
  const selectAll = db.query<Row, []>(`SELECT ${COLUMNS} FROM tag ORDER BY name`);
  const selectById = db.query<Row, [string]>(`SELECT ${COLUMNS} FROM tag WHERE id = ?`);
  const selectByName = db.query<Row, [string]>(`SELECT ${COLUMNS} FROM tag WHERE name = ?`);
  const selectBySlug = db.query<Row, [string]>(`SELECT ${COLUMNS} FROM tag WHERE slug = ?`);
  const slugTaken = db.query<{ id: string }, [string, string]>("SELECT id FROM tag WHERE slug = ? AND id <> ?");
  const insert = db.prepare(`INSERT INTO tag (${COLUMNS}) VALUES (?, ?, ?)`);
  const save = db.prepare("UPDATE tag SET name = ?, slug = ? WHERE id = ?");
  const del = db.prepare("DELETE FROM tag WHERE id = ?");

  function get(id: string): Tag | null {
    return selectById.get(id) ?? null;
  }

  function slugFor(name: string, ownId: string): string {
    return uniqueSlug(slugify(name), (s) => slugTaken.get(s, ownId) !== null);
  }

  function create(input: TagInput): Tag {
    const id = crypto.randomUUID();
    const name = cleanName(input.name);
    insert.run(id, name, slugFor(name, id));
    return get(id)!;
  }

  return {
    list: (): Tag[] => selectAll.all(),
    get,
    getBySlug: (slug: string): Tag | null => selectBySlug.get(slug) ?? null,
    create,

    /** Rename; the slug follows the new name. Null when `id` is unknown. */
    update(id: string, patch: Partial<TagInput>): Tag | null {
      const current = get(id);
      if (!current) return null;
      const name = cleanName(patch.name ?? current.name);
      save.run(name, slugFor(name, id), id);
      return get(id);
    },

    /** True when a row was deleted. recipe_tag links cascade; recipes stay. */
    remove: (id: string): boolean => del.run(id).changes > 0,

    /** Existing tag whose name matches case-insensitively, else a new one. */
    findOrCreate(name: string): Tag {
      const clean = cleanName(name);
      return selectByName.get(clean) ?? create({ name: clean });
    },
  };
}

export type TagRepository = ReturnType<typeof tags>;
