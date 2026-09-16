import type { Database } from "bun:sqlite";
import { and, asc, eq, exists, inArray, ne, type SQL, sql } from "drizzle-orm";
import {
  type Ingredient,
  type ParsedRecipeInput,
  type Part,
  type Recipe,
  type RecipeNote,
  type RecipeSummary,
  resolveSort,
  type SortDir,
  type SortKey,
  type Step,
} from "../../../domain/recipe";
import type { Food, Tag, Unit } from "../../../domain/reference";
import { lazy } from "../../../lib/lazy";
import { seededOrder } from "../../../lib/lists";
import { slugify, uniqueSlug } from "../../../lib/names";
import { getDb } from "../../../server/core/db";
import { type Executor, orm } from "../../connection/client";
import { aisleRepository } from "../aisle/repo";
import { foodRepository } from "../food/repo";
import { tagRepository } from "../tag/repo";
import { tag } from "../tag/schema";
import { unitRepository } from "../unit/repo";
import { type RecipeRecord, type RecipeStorage, recipeRecord } from "./record";
import { ingredient, part, recipe, recipeNote, recipeTag, step, stepIngredient } from "./schema";
import { type SummaryRow, selectTags, summarise, summaryColumns } from "./summary";

/** How many ingredient lines a summary carries. */
export const INGREDIENT_PREVIEW_LIMIT = 6;

// =============================================================================
// Which recipes: the query grammar. One discriminated union for every way of
// asking the collection, each answered as card summaries.
// =============================================================================

/** The faceted question: any combination of name substring, tags, foods and favourite, ordered by `sort`. */
export type RecipeFilter = {
  /** Case-insensitive substring of the recipe name. Empty is no constraint. */
  q?: string;
  /** Tag slugs; only recipes carrying them. */
  tags?: string[];
  /** How `tags` combine: any of them (default) or all of them. */
  match?: "any" | "all";
  /** Food ids; only recipes with an ingredient using one of these foods. */
  foods?: string[];
  /** Only favourited recipes when true; unset or false is unfiltered. */
  favourite?: boolean;
  /** Sort key. Unset keeps the original newest-first order. */
  sort?: SortKey;
  /** Sort direction. Unset defaults per key, see `resolveSort`. Ignored for `sort: "random"`. */
  dir?: SortDir;
  /** Shuffle seed for `sort: "random"`: the same seed reproduces the same order. Unset shuffles with an empty seed, which is still stable across calls. */
  seed?: string;
};

export type RecipeQuery =
  /** The faceted question; `{ by: "filter" }` alone is every recipe, newest first. */
  | ({ by: "filter" } & RecipeFilter)
  /** Recipes with an ingredient of this food. */
  | { by: "food"; id: string }
  /** Recipes measuring an ingredient, or their yield, in this unit. */
  | { by: "unit"; id: string }
  /** Recipes carrying this tag. */
  | { by: "tag"; id: string }
  /** Recipes imported from exactly this address: a URL that differs by a tracking parameter is a different address. */
  | { by: "url"; url: string }
  /** Recipes under exactly this name, case-insensitively. */
  | { by: "name"; name: string };

/** Recipe name, compared case-insensitively: the secondary order of every answer. */
const byName = sql`${recipe.name} COLLATE NOCASE`;

/**
 * `ORDER BY` for every key but "random" (handled in JS, see `seededOrder`).
 * `lastMade` and `rating` put nulls last regardless of `dir` — an unrated or
 * never-made recipe reads as "not applicable", not as the lowest value. A name
 * tie-break, then `recipe.id`, keeps the order fully determinate.
 */
function orderClause(sort: Exclude<SortKey, "random">, dir: SortDir): SQL[] {
  const d = dir === "asc" ? sql`ASC` : sql`DESC`;
  switch (sort) {
    case "name":
      return [sql`${byName} ${d}`, sql`${recipe.id}`];
    case "updated":
      return [sql`${recipe.updatedAt} ${d}`, byName, sql`${recipe.id}`];
    case "lastMade":
      return [sql`(${recipe.lastMade} IS NULL)`, sql`${recipe.lastMade} ${d}`, byName, sql`${recipe.id}`];
    case "rating":
      return [sql`(${recipe.rating} IS NULL)`, sql`${recipe.rating} ${d}`, byName, sql`${recipe.id}`];
    case "created":
      return [sql`${recipe.createdAt} ${d}`, byName, sql`${recipe.id}`];
  }
}

/**
 * The recipe is one aggregate: the `recipe` row owns its parts, ingredients,
 * steps, step links, notes and tag links, and points at units, foods, aisles
 * and tags that other repositories own. The repository is the collection:
 * get, query, create, remove. `ref(id)` is the record: one recipe and the
 * operations done to it — replace the document, or one field, or the steps.
 */
export function recipeRepository(db: Database) {
  const dz = orm(db);
  const units = unitRepository(db);
  const foods = foodRepository(db);
  const aisles = aisleRepository(db);
  const tags = tagRepository(db);

  // ===========================================================================
  // References: the document's units, foods, aisles and tags <-> their rows.
  //
  // Down: by id when that row exists, else by name (NOCASE), else a new row
  // copying the document's attributes. The id the caller sent is not kept for
  // new rows. Existing reference rows are never modified by a recipe write.
  // Up: by id, cached per document so one recipe reads each unit once.
  // ===========================================================================

  function resolveAisle(ref: Food["aisle"]): string | null {
    if (!ref) return null;
    return (aisles.get(ref.id) ?? aisles.findOrCreate(ref.name)).id;
  }

  function resolveUnit(ref: Unit | null): string | null {
    if (!ref) return null;
    const existing = units.get(ref.id) ?? units.getByName(ref.name);
    if (existing) return existing.id;
    return units.create({
      name: ref.name,
      pluralName: ref.pluralName,
      abbreviation: ref.abbreviation,
      useAbbreviation: ref.useAbbreviation,
      fraction: ref.fraction,
      standardQuantity: ref.standardQuantity,
      standardUnitId: ref.standardUnitId && units.get(ref.standardUnitId) ? ref.standardUnitId : null,
    }).id;
  }

  function resolveFood(ref: Food | null): string | null {
    if (!ref) return null;
    const existing = foods.get(ref.id) ?? foods.getByName(ref.name);
    if (existing) return existing.id;
    return foods.create({
      name: ref.name,
      pluralName: ref.pluralName,
      aliases: ref.aliases,
      aisleId: resolveAisle(ref.aisle),
      recipeId: ref.recipeId && rowById(ref.recipeId) ? ref.recipeId : null,
      skipShopping: ref.skipShopping,
    }).id;
  }

  function resolveTag(ref: Tag): string {
    return (tags.get(ref.id) ?? tags.findOrCreate(ref.name)).id;
  }

  function readUnit(id: string | null, cache: Map<string, Unit | null>): Unit | null {
    if (!id) return null;
    if (!cache.has(id)) cache.set(id, units.get(id));
    return cache.get(id) ?? null;
  }

  function readFood(id: string | null, cache: Map<string, Food | null>): Food | null {
    if (!id) return null;
    if (!cache.has(id)) {
      const row = foods.get(id);
      if (!row) cache.set(id, null);
      else {
        const { aisleId, ...rest } = row;
        cache.set(id, { ...rest, aisle: aisleId ? aisles.get(aisleId) : null });
      }
    }
    return cache.get(id) ?? null;
  }

  // ===========================================================================
  // Reading a document: the recipe row and its children back into a Recipe.
  // ===========================================================================

  function rowById(id: string) {
    return dz.select().from(recipe).where(eq(recipe.id, id)).get();
  }

  function assemble(row: typeof recipe.$inferSelect): Recipe {
    const unitCache = new Map<string, Unit | null>();
    const foodCache = new Map<string, Food | null>();

    const ingredientRows = dz
      .select({
        id: ingredient.id,
        partId: ingredient.partId,
        quantity: ingredient.quantity,
        unitId: ingredient.unitId,
        foodId: ingredient.foodId,
        note: ingredient.note,
        originalText: ingredient.originalText,
        fixed: ingredient.fixed,
      })
      .from(ingredient)
      .innerJoin(part, eq(part.id, ingredient.partId))
      .where(eq(part.recipeId, row.id))
      .orderBy(asc(part.position), asc(ingredient.position))
      .all();

    const ingredientsByPart = new Map<string, Ingredient[]>();
    for (const i of ingredientRows) {
      const list = ingredientsByPart.get(i.partId) ?? [];
      list.push({
        id: i.id,
        quantity: i.quantity,
        unit: readUnit(i.unitId, unitCache),
        food: readFood(i.foodId, foodCache),
        note: i.note,
        originalText: i.originalText,
        fixed: i.fixed,
      });
      ingredientsByPart.set(i.partId, list);
    }

    const stepRows = dz
      .select({ id: step.id, partId: step.partId, text: step.text, image: step.image })
      .from(step)
      .innerJoin(part, eq(part.id, step.partId))
      .where(eq(part.recipeId, row.id))
      .orderBy(asc(part.position), asc(step.position))
      .all();

    // Step links, in the order they were written. Both ends are in this recipe
    // by construction, so joining through the step's part scopes the read.
    const linkRows = dz
      .select({ stepId: stepIngredient.stepId, ingredientId: stepIngredient.ingredientId })
      .from(stepIngredient)
      .innerJoin(step, eq(step.id, stepIngredient.stepId))
      .innerJoin(part, eq(part.id, step.partId))
      .where(eq(part.recipeId, row.id))
      .orderBy(asc(stepIngredient.position))
      .all();

    const linksByStep = new Map<string, string[]>();
    for (const link of linkRows) {
      const list = linksByStep.get(link.stepId) ?? [];
      list.push(link.ingredientId);
      linksByStep.set(link.stepId, list);
    }

    const stepsByPart = new Map<string, Step[]>();
    for (const s of stepRows) {
      const list = stepsByPart.get(s.partId) ?? [];
      list.push({ id: s.id, text: s.text, ingredientIds: linksByStep.get(s.id) ?? [], image: s.image });
      stepsByPart.set(s.partId, list);
    }

    const parts: Part[] = dz
      .select({ id: part.id, name: part.name })
      .from(part)
      .where(eq(part.recipeId, row.id))
      .orderBy(asc(part.position))
      .all()
      .map((p) => ({
        id: p.id,
        name: p.name,
        ingredients: ingredientsByPart.get(p.id) ?? [],
        steps: stepsByPart.get(p.id) ?? [],
      }));

    const notes: RecipeNote[] = dz
      .select({ id: recipeNote.id, title: recipeNote.title, text: recipeNote.text })
      .from(recipeNote)
      .where(eq(recipeNote.recipeId, row.id))
      .orderBy(asc(recipeNote.position))
      .all();

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      image: row.image,
      rating: row.rating,
      lastMade: row.lastMade,
      recipeServings: row.servings,
      recipeYieldQuantity: row.yieldQuantity,
      yieldUnit: readUnit(row.yieldUnitId, unitCache),
      recipeYield: row.yieldText,
      prepTime: row.prepMinutes,
      performTime: row.cookMinutes,
      sourceUrl: row.sourceUrl,
      favourite: row.favourite,
      restyledAt: row.restyledAt,
      notes,
      tags: selectTags(dz, row.id),
      parts,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  function getById(id: string): Recipe | null {
    const row = rowById(id);
    return row ? assemble(row) : null;
  }

  // ===========================================================================
  // Writing a document: the recipe row's values, its slug, and every child row
  // deleted and re-inserted from the document with positions from array order.
  // ===========================================================================

  function slugFor(name: string, ownId: string): string {
    return uniqueSlug(slugify(name), (s) => {
      const clash = dz
        .select({ id: recipe.id })
        .from(recipe)
        .where(and(eq(recipe.slug, s), ne(recipe.id, ownId)))
        .get();
      return clash !== undefined;
    });
  }

  /** The recipe row's columns as the document spells them; the id and stamps are the caller's. */
  function recipeValues(doc: ParsedRecipeInput) {
    return {
      name: doc.name,
      description: doc.description,
      image: doc.image,
      rating: doc.rating,
      lastMade: doc.lastMade,
      servings: doc.recipeServings,
      yieldQuantity: doc.recipeYieldQuantity,
      yieldUnitId: resolveUnit(doc.yieldUnit),
      yieldText: doc.recipeYield,
      prepMinutes: doc.prepTime,
      cookMinutes: doc.performTime,
      sourceUrl: doc.sourceUrl,
      favourite: doc.favourite,
    };
  }

  function writeChildren(tx: Executor, recipeId: string, doc: ParsedRecipeInput): void {
    // A part's kept original steps are not in the document, and a save
    // rewrites every part row, so they are carried across by part id: the
    // editor sends back the ids of the parts it loaded, and a part that keeps
    // its id keeps the author's words with it. A part the save invented has no
    // id to match and starts with none, which is right — it has no original.
    const keptSourceSteps = new Map(
      tx
        .select({ id: part.id, sourceSteps: part.sourceSteps })
        .from(part)
        .where(eq(part.recipeId, recipeId))
        .all()
        .filter((row): row is { id: string; sourceSteps: string[] } => row.sourceSteps !== null)
        .map((row) => [row.id, row.sourceSteps] as const)
    );

    tx.delete(recipeTag).where(eq(recipeTag.recipeId, recipeId)).run();
    tx.delete(recipeNote).where(eq(recipeNote.recipeId, recipeId)).run();
    tx.delete(part).where(eq(part.recipeId, recipeId)).run(); // steps, ingredients and their links cascade

    for (const t of doc.tags) {
      tx.insert(recipeTag)
        .values({ recipeId, tagId: resolveTag(t) })
        .onConflictDoNothing()
        .run();
    }

    doc.notes.forEach((note, position) => {
      tx.insert(recipeNote)
        .values({ id: note.id ?? crypto.randomUUID(), recipeId, position, title: note.title, text: note.text })
        .run();
    });

    doc.parts.forEach((p, position) => {
      const partId = p.id ?? crypto.randomUUID();
      tx.insert(part)
        .values({ id: partId, recipeId, position, name: p.name, sourceSteps: keptSourceSteps.get(partId) ?? null })
        .run();
      // Ingredients first: their ids are what the part's steps may link to.
      // A line the document gave no id gets a fresh one, which nothing can name.
      const linkable = new Set<string>();
      p.ingredients.forEach((line, i) => {
        const ingredientId = line.id ?? crypto.randomUUID();
        linkable.add(ingredientId);
        tx.insert(ingredient)
          .values({
            id: ingredientId,
            partId,
            position: i,
            quantity: line.quantity,
            unitId: resolveUnit(line.unit),
            foodId: resolveFood(line.food),
            note: line.note,
            originalText: line.originalText,
            fixed: line.fixed,
          })
          .run();
      });
      // Then the steps, then their links: a link is dropped, not raised, when it
      // names an ingredient outside this part or names one twice. A saved recipe
      // is never rejected over a stale link.
      p.steps.forEach((s, i) => {
        const stepId = s.id ?? crypto.randomUUID();
        tx.insert(step).values({ id: stepId, partId, position: i, text: s.text, image: s.image }).run();
        const seen = new Set<string>();
        for (const ingredientId of s.ingredientIds) {
          if (!linkable.has(ingredientId) || seen.has(ingredientId)) continue;
          seen.add(ingredientId);
          tx.insert(stepIngredient)
            .values({ stepId, ingredientId, position: seen.size - 1 })
            .run();
        }
      });
    });
  }

  // ===========================================================================
  // The repository: the collection of recipes.
  // ===========================================================================

  // ===========================================================================
  // Which recipes: answering a RecipeQuery with summary rows.
  // ===========================================================================

  /** Rows for the faceted question: each facet present adds a clause, then the sort applies. */
  function filterRows(filter: RecipeFilter): SummaryRow[] {
    const tagSlugs = filter.tags ?? [];
    const foodIds = filter.foods ?? [];

    /** Recipes carrying the tag whose slug satisfies `slugs`. */
    const hasTag = (slugs: SQL) =>
      exists(
        dz
          .select({ one: sql`1` })
          .from(recipeTag)
          .innerJoin(tag, eq(tag.id, recipeTag.tagId))
          .where(and(eq(recipeTag.recipeId, recipe.id), slugs))
      );

    const clauses: (SQL | undefined)[] = [];

    if (filter.q) clauses.push(sql`instr(lower(${recipe.name}), lower(${filter.q})) > 0`);

    if (tagSlugs.length > 0) {
      if (filter.match === "all") for (const slug of tagSlugs) clauses.push(hasTag(eq(tag.slug, slug)));
      else clauses.push(hasTag(inArray(tag.slug, tagSlugs)));
    }

    if (foodIds.length > 0) {
      clauses.push(
        exists(
          dz
            .select({ one: sql`1` })
            .from(part)
            .innerJoin(ingredient, eq(ingredient.partId, part.id))
            .where(and(eq(part.recipeId, recipe.id), inArray(ingredient.foodId, foodIds)))
        )
      );
    }

    if (filter.favourite) clauses.push(eq(recipe.favourite, true));

    const where = clauses.length > 0 ? and(...clauses) : undefined;
    const { key: sort, dir } = resolveSort(filter.sort, filter.dir);
    const query = dz.select(summaryColumns).from(recipe).where(where);

    if (sort === "random") return seededOrder(query.all(), filter.seed ?? "");
    return query.orderBy(...orderClause(sort, dir)).all();
  }

  // The reference questions answer "which recipes would notice if this row
  // went away". Deleting the row itself is harmless in SQL — every reference is
  // ON DELETE SET NULL or CASCADE — so the point is to say what changes, not to
  // block. A recipe is listed once however many of its rows use the reference.
  function queryRows(q: RecipeQuery): SummaryRow[] {
    switch (q.by) {
      case "filter":
        return filterRows(q);
      case "food":
        return dz
          .selectDistinct(summaryColumns)
          .from(recipe)
          .innerJoin(part, eq(part.recipeId, recipe.id))
          .innerJoin(ingredient, eq(ingredient.partId, part.id))
          .where(eq(ingredient.foodId, q.id))
          .orderBy(byName)
          .all();
      case "unit":
        return (
          dz
            .select(summaryColumns)
            .from(recipe)
            // A unit reaches a recipe two ways: an ingredient amount, or the yield.
            .where(
              sql`${recipe.yieldUnitId} = ${q.id} OR ${exists(
                dz
                  .select({ one: sql`1` })
                  .from(part)
                  .innerJoin(ingredient, eq(ingredient.partId, part.id))
                  .where(and(eq(part.recipeId, recipe.id), eq(ingredient.unitId, q.id)))
              )}`
            )
            .orderBy(byName)
            .all()
        );
      case "tag":
        return dz
          .select(summaryColumns)
          .from(recipe)
          .innerJoin(recipeTag, eq(recipeTag.recipeId, recipe.id))
          .where(eq(recipeTag.tagId, q.id))
          .orderBy(byName)
          .all();
      case "url":
        return dz.select(summaryColumns).from(recipe).where(eq(recipe.sourceUrl, q.url)).orderBy(byName).all();
      case "name":
        return dz.select(summaryColumns).from(recipe).where(sql`${recipe.name} = ${q.name} COLLATE NOCASE`).orderBy(byName).all();
    }
  }

  const storage: RecipeStorage = { dz, foods, rowById, getById, readUnit, slugFor, recipeValues, writeChildren };

  return {
    // --- The document -------------------------------------------------------

    /** Full document by slug, or null. */
    get(slug: string): Recipe | null {
      const row = dz.select().from(recipe).where(eq(recipe.slug, slug)).get();
      return row ? assemble(row) : null;
    },

    /** Full document by id, or null. */
    getById,

    /**
     * Which recipes, as summaries ordered by name unless the query says
     * otherwise. Every way of asking the collection goes through here; see
     * `RecipeQuery`. With no argument, every recipe, newest first.
     */
    query(q: RecipeQuery = { by: "filter" }): RecipeSummary[] {
      return queryRows(q).map((row) => summarise(dz, row));
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

    /** One recipe by id: the record with the operations done to it. Nothing is read until a method is called. */
    ref: (id: string): RecipeRecord => recipeRecord(storage, id),

    /** True when a recipe was deleted. Children cascade; references stay. */
    remove: (id: string): boolean => dz.delete(recipe).where(eq(recipe.id, id)).returning({ id: recipe.id }).all().length > 0,
  };
}

export type RecipeRepository = ReturnType<typeof recipeRepository>;
export type { RecipeRecord } from "./record";

/** The repository over the application database. Tests build their own with `recipeRepository(db)`. */
export default lazy(getDb, recipeRepository);
