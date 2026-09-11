// Tag repository. Server-only. Names unique case-insensitively; the slug is
// derived from the name (Mealie) and de-duplicated with a numeric suffix.
import type { Database } from "bun:sqlite";
import { cleanName, likePattern, slugify, uniqueSlug } from "./names";

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
  const selectLike = db.query<Row, [string]>(`SELECT ${COLUMNS} FROM tag WHERE name LIKE ? ESCAPE '\\' ORDER BY name`);
  const selectById = db.query<Row, [string]>(`SELECT ${COLUMNS} FROM tag WHERE id = ?`);
  const selectByName = db.query<Row, [string]>(`SELECT ${COLUMNS} FROM tag WHERE name = ?`);
  const selectBySlug = db.query<Row, [string]>(`SELECT ${COLUMNS} FROM tag WHERE slug = ?`);
  const slugTaken = db.query<{ id: string }, [string, string]>("SELECT id FROM tag WHERE slug = ? AND id <> ?");
  const insert = db.prepare(`INSERT INTO tag (${COLUMNS}) VALUES (?, ?, ?)`);
  const save = db.prepare("UPDATE tag SET name = ?, slug = ? WHERE id = ?");
  const del = db.prepare("DELETE FROM tag WHERE id = ?");
  // `recipe_tag`'s primary key is (recipe_id, tag_id), so a recipe carrying
  // both the source and the target already would collide on a plain
  // repoint; OR IGNORE skips just that row and keeps the target's link.
  const repointRecipeTags = db.prepare(
    "INSERT OR IGNORE INTO recipe_tag (recipe_id, tag_id) SELECT recipe_id, ? FROM recipe_tag WHERE tag_id = ?",
  );

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
    /** All tags by name, or those whose name contains `q` (case-insensitive). */
    list: (q?: string): Tag[] => (q?.trim() ? selectLike.all(likePattern(q)) : selectAll.all()),
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

    /**
     * Merge `sourceId` into `targetId`: every recipe carrying the source tag
     * gains the target tag, then the source is deleted — cascading away its
     * now-redundant `recipe_tag` rows — in one transaction. Null when either
     * id is unknown. Merging a tag into itself is a no-op that returns it.
     */
    merge(sourceId: string, targetId: string): Tag | null {
      if (sourceId === targetId) return get(targetId);
      const target = get(targetId);
      if (!target || !get(sourceId)) return null;
      const mergeTx = db.transaction(() => {
        repointRecipeTags.run(targetId, sourceId);
        del.run(sourceId);
      });
      mergeTx();
      return get(targetId);
    },
  };
}

export type TagRepository = ReturnType<typeof tags>;
