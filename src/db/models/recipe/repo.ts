import type { Database } from "bun:sqlite";
import { eq, sql } from "drizzle-orm";
import type { ParsedRecipeInput, Recipe, RecipeSummary } from "../../../domain/recipe";
import { recipeContext } from "./context";
import { type ListFilter, listRows } from "./list";
import { readers } from "./read";
import { restylers } from "./restyle";
import { recipe, step } from "./schema";
import { usage } from "./usage";
import { nowUtc, writers } from "./write";

export function recipes(db: Database) {
  const ctx = recipeContext(db);
  const { dz } = ctx;
  const read = readers(ctx);
  const { rowById, assemble, summarise, getById } = read;
  const write = writers(ctx, read);
  const { slugFor, recipeValues, writeChildren } = write;
  const { subRecipes, usingFood, usingUnit, usingTag } = usage(ctx, read);
  const { restyleParts, restoreParts } = restylers(ctx, read, write);

  return {
    /** Full document by slug, or null. */
    get(slug: string): Recipe | null {
      const row = dz.select().from(recipe).where(eq(recipe.slug, slug)).get();
      return row ? assemble(row) : null;
    },

    /** Full document by id, or null. */
    getById,

    /**
     * The name and slug of a recipe already imported from `sourceUrl`, or null
     *. One query behind the import's "you already have this" warning,
     * which is Tandoor's `RecipeUrlImportView` behaviour. Matched exactly: a
     * URL that differs by a tracking parameter is a different address, and
     * guessing which parameters are noise is not worth a wrong answer.
     */
    bySourceUrl(sourceUrl: string): { name: string; slug: string } | null {
      const url = sourceUrl.trim();
      if (url === "") return null;
      const row = dz.select({ name: recipe.name, slug: recipe.slug }).from(recipe).where(eq(recipe.sourceUrl, url)).get();
      return row ?? null;
    },

    /**
     * The name and slug of a recipe already here under `name`, or null
     *. The same warning as `bySourceUrl`, for an import that has no
     * address to compare — a Mealie export carries a name and often nothing
     * else. Matched case-insensitively, as the name sort is.
     */
    byName(name: string): { name: string; slug: string } | null {
      const wanted = name.trim();
      if (wanted === "") return null;
      const row = dz.select({ name: recipe.name, slug: recipe.slug }).from(recipe).where(sql`${recipe.name} = ${wanted} COLLATE NOCASE`).get();
      return row ?? null;
    },

    /** Card summaries filtered and ordered by `filter`; see `listRows` (list.ts) for the rules. */
    list(filter: ListFilter = {}): RecipeSummary[] {
      return listRows(ctx, filter).map(summarise);
    },

    /** Insert a recipe and its children in one transaction; the slug comes from the name. */
    create(doc: ParsedRecipeInput): Recipe {
      const id = doc.id ?? crypto.randomUUID();
      dz.transaction((tx) => {
        tx.insert(recipe)
          .values({ id, slug: slugFor(doc.name, id), ...recipeValues(doc) })
          .run();
        writeChildren(tx, id, doc);
      });
      return getById(id)!;
    },

    /**
     * Replace the recipe with `doc`, keeping its id, slug and created_at.
     * Children are deleted and re-inserted in the same transaction. Null when `id` is unknown.
     */
    update(id: string, doc: ParsedRecipeInput): Recipe | null {
      const current = rowById(id);
      if (!current) return null;
      dz.transaction((tx) => {
        // Mealie: the slug follows the name only when the name changes.
        const slug = current.name === doc.name ? current.slug : slugFor(doc.name, id);
        tx.update(recipe)
          .set({ slug, ...recipeValues(doc), updatedAt: nowUtc })
          .where(eq(recipe.id, id))
          .run();
        writeChildren(tx, id, doc);
      });
      return getById(id);
    },

    /** Set the favourite flag alone. Nothing else changes, `updated_at` included. True when `id` exists. */
    setFavourite: (id: string, favourite: boolean): boolean =>
      dz.update(recipe).set({ favourite }).where(eq(recipe.id, id)).returning({ id: recipe.id }).all().length > 0,

    /**
     * Set the rating alone (null clears it), and touch `updated_at`. Nothing
     * else changes. True when `id` exists.
     */
    setRating: (id: string, rating: number | null): boolean =>
      dz.update(recipe).set({ rating, updatedAt: nowUtc }).where(eq(recipe.id, id)).returning({ id: recipe.id }).all().length > 0,

    /** Set the image file name alone (null clears it). Nothing else changes. True when `id` exists. */
    setImage: (id: string, image: string | null): boolean =>
      dz.update(recipe).set({ image, updatedAt: nowUtc }).where(eq(recipe.id, id)).returning({ id: recipe.id }).all().length > 0,

    /**
     * Set one step's image file name (null clears it), leaving the recipe's
     * `updated_at` alone: the photo is stored beside the document, not by it,
     * and the document keeps the name so the next save re-inserts it.
     * True when the step exists.
     */
    setStepImage: (stepId: string, image: string | null): boolean =>
      dz.update(step).set({ image }).where(eq(step.id, stepId)).returning({ id: step.id }).all().length > 0,

    /** Does a step row exist? What the upload route asks before writing a file. */
    stepExists: (stepId: string): boolean => dz.select({ id: step.id }).from(step).where(eq(step.id, stepId)).all().length > 0,

    subRecipes,
    usingFood,
    usingUnit,
    usingTag,
    restyleParts,
    restoreParts,

    /** True when a recipe was deleted. Children cascade; references stay. */
    remove: (id: string): boolean => dz.delete(recipe).where(eq(recipe.id, id)).returning({ id: recipe.id }).all().length > 0,
  };
}

export type RecipeRepository = ReturnType<typeof recipes>;
