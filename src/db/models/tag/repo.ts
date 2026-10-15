import type { Database } from "bun:sqlite";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { type TagUsage, tagKey, tagName } from "../../../domain/reference";
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

export function tagRepository(db: Database) {
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

  /** The house rule's name (domain/reference/tagName.ts); throws when nothing is left. */
  function houseName(raw: string): string {
    return cleanName(tagName(raw));
  }

  /** The tag whose name has `name`'s key, if any: a match the column's ASCII-only NOCASE would miss ("Crème" and "CRÈME"). */
  function byKey(name: string): Tag | null {
    const key = tagKey(name);
    return (
      dz
        .select()
        .from(tag)
        .all()
        .find((row) => tagKey(row.name) === key) ?? null
    );
  }

  function create(input: TagInput): Tag {
    const id = crypto.randomUUID();
    const name = houseName(input.name);
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
    /** Every tag with the number of recipes carrying it, by name. */
    usage(): TagUsage[] {
      return dz
        .select({ id: tag.id, name: tag.name, slug: tag.slug, recipes: sql<number>`count(${recipeTag.recipeId})` })
        .from(tag)
        .leftJoin(recipeTag, eq(recipeTag.tagId, tag.id))
        .groupBy(tag.id)
        .orderBy(asc(tag.name))
        .all();
    },
    get,
    getBySlug: (slug: string): Tag | null => dz.select().from(tag).where(eq(tag.slug, slug)).get() ?? null,
    create,

    /** Rename; the slug follows the new name. Null when `id` is unknown. */
    update(id: string, patch: Partial<TagInput>): Tag | null {
      const current = get(id);
      if (!current) return null;
      const name = houseName(patch.name ?? current.name);
      dz.update(tag)
        .set({ name, slug: slugFor(name, id) })
        .where(eq(tag.id, id))
        .run();
      return get(id);
    },

    /** True when a row was deleted. recipe_tag links cascade; recipes stay. */
    remove,

    /** Existing tag whose name has the same key (case, spacing, a leading #), else a new one in the house style. */
    findOrCreate(name: string): Tag {
      const clean = houseName(name);
      return byKey(clean) ?? create({ name: clean });
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

export type TagRepository = ReturnType<typeof tagRepository>;

/** The repository over the application database. Tests build their own with `tagRepository(db)`. */
export default lazy(getDb, tagRepository);
