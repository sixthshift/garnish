import type { Database } from "bun:sqlite";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { lazy } from "../../../lib/lazy";
import { cleanName, likePattern, slugify, uniqueSlug } from "../../../lib/names";
import { getDb } from "../../../server/core/db";
import { orm } from "../../connection/client";
import { recipeTag } from "../recipe/schema";
import { tag } from "./schema";

export type Tag = {
  id: string;
  name: string;
  slug: string;
};

export type TagInput = { name: string };

export function tags(db: Database) {
  const dz = orm(db);

  function get(id: string): Tag | null {
    return dz.select().from(tag).where(eq(tag.id, id)).get() ?? null;
  }

  function slugFor(name: string, ownId: string): string {
    return uniqueSlug(slugify(name), (s) => {
      const clash = dz
        .select({ id: tag.id })
        .from(tag)
        .where(and(eq(tag.slug, s), ne(tag.id, ownId)))
        .get();
      return clash !== undefined;
    });
  }

  function create(input: TagInput): Tag {
    const id = crypto.randomUUID();
    const name = cleanName(input.name);
    dz.insert(tag)
      .values({ id, name, slug: slugFor(name, id) })
      .run();
    return get(id)!;
  }

  function remove(id: string): boolean {
    return dz.delete(tag).where(eq(tag.id, id)).returning({ id: tag.id }).all().length > 0;
  }

  return {
    /** All tags by name, or those whose name contains `q` (case-insensitive). */
    list(q?: string): Tag[] {
      const query = dz.select().from(tag);
      return q?.trim()
        ? query
            .where(sql`${tag.name} LIKE ${likePattern(q)} ESCAPE '\\'`)
            .orderBy(asc(tag.name))
            .all()
        : query.orderBy(asc(tag.name)).all();
    },
    get,
    getBySlug: (slug: string): Tag | null => dz.select().from(tag).where(eq(tag.slug, slug)).get() ?? null,
    create,

    /** Rename; the slug follows the new name. Null when `id` is unknown. */
    update(id: string, patch: Partial<TagInput>): Tag | null {
      const current = get(id);
      if (!current) return null;
      const name = cleanName(patch.name ?? current.name);
      dz.update(tag)
        .set({ name, slug: slugFor(name, id) })
        .where(eq(tag.id, id))
        .run();
      return get(id);
    },

    /** True when a row was deleted. recipe_tag links cascade; recipes stay. */
    remove,

    /** Existing tag whose name matches case-insensitively, else a new one. */
    findOrCreate(name: string): Tag {
      const clean = cleanName(name);
      return dz.select().from(tag).where(eq(tag.name, clean)).get() ?? create({ name: clean });
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
      dz.transaction((tx) => {
        // `recipe_tag`'s primary key is (recipe_id, tag_id), so a recipe
        // carrying both the source and the target already would collide on a
        // plain repoint; DO NOTHING skips just that row and keeps the target's.
        tx.insert(recipeTag)
          .select(
            tx
              .select({ recipeId: recipeTag.recipeId, tagId: sql`${targetId}`.as("tag_id") })
              .from(recipeTag)
              .where(eq(recipeTag.tagId, sourceId))
          )
          .onConflictDoNothing()
          .run();
        tx.delete(tag).where(eq(tag.id, sourceId)).run();
      });
      return get(targetId);
    },
  };
}

export type TagRepository = ReturnType<typeof tags>;

/** The repository over the application database. Tests build their own with `tags(db)`. */
export default lazy(getDb, tags);
