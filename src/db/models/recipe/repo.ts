// Recipe repository. Server-only; pass the Database opened by openDatabase.
// Reads and writes exactly the document in src/domain/recipe.ts.
//
// Writes replace the whole recipe in one transaction: the recipe row is
// inserted or updated, every child row (note, part, ingredient, step,
// step_ingredient, recipe_tag) is deleted and re-inserted from the document, positions come
// from array index. Referenced units, foods, tags and aisles are resolved by
// id, then by name (case-insensitive); a name nobody has yet is inserted so a
// document with a new tag or food saves. Existing reference rows are never
// modified by a recipe write.
import type { Database } from "bun:sqlite";
import { and, asc, eq, exists, inArray, ne, type SQL, sql } from "drizzle-orm";
import type {
  Food,
  Ingredient,
  ParsedRecipeInput,
  Part,
  Recipe,
  RecipeNote,
  RecipeSummary,
  Step,
  Tag,
  Unit,
} from "../../../domain/recipe";
import { totalMinutes } from "../../../domain/format";
import { resolveSort, seededOrder, type SortDir, type SortKey } from "../../../domain/sort";
import type { SubRecipe } from "../../../domain/subRecipe";
import { aisles as aisleRepository } from "../aisle/repo";
import { type Executor, orm } from "../../connection/client";
import { foods as foodRepository } from "../food/repo";
import { slugify, uniqueSlug } from "../../../domain/names";
import { tag } from "../tag/schema";
import { ingredient, part, recipe, recipeNote, recipeTag, step, stepIngredient } from "./schema";
import { tags as tagRepository } from "../tag/repo";
import { units as unitRepository } from "../unit/repo";

export type ListFilter = {
  /** Case-insensitive substring of the recipe name. */
  q?: string;
  /** Tag slug; only recipes carrying that tag. Folded into `tags` (M12.3). */
  tag?: string;
  /** Tag slugs; combined with `tag` (if given), de-duplicated. */
  tags?: string[];
  /** How `tags` combine: any of them (default) or all of them. */
  match?: "any" | "all";
  /** Food ids; only recipes with an ingredient using one of these foods. */
  foods?: string[];
  /** Only favourited recipes when true; unset or false is unfiltered. */
  favourite?: boolean;
  /** Sort key (M12.4). Unset keeps the original newest-first order. */
  sort?: SortKey;
  /** Sort direction. Unset defaults per key, see `resolveSort`. Ignored for `sort: "random"`. */
  dir?: SortDir;
  /** Shuffle seed for `sort: "random"`: the same seed reproduces the same order. Unset shuffles with an empty seed, which is still stable across calls. */
  seed?: string;
};

/** The recipe columns a card needs. The shape `summarise` reads. */
const summaryColumns = {
  id: recipe.id,
  slug: recipe.slug,
  name: recipe.name,
  image: recipe.image,
  rating: recipe.rating,
  prepMinutes: recipe.prepMinutes,
  cookMinutes: recipe.cookMinutes,
  lastMade: recipe.lastMade,
  favourite: recipe.favourite,
};

type SummaryRow = Pick<
  typeof recipe.$inferSelect,
  "id" | "slug" | "name" | "image" | "rating" | "prepMinutes" | "cookMinutes" | "lastMade" | "favourite"
>;

/** Recipe name, compared the way the list page orders it. */
const byName = sql`${recipe.name} COLLATE NOCASE`;

/**
 * `ORDER BY` for every key but "random" (handled separately in JS, see
 * `seededOrder`). `lastMade` and `rating` put nulls last regardless of `dir` —
 * an unrated or never-made recipe reads as "not applicable", not as the lowest
 * value. A name tie-break, then `recipe.id`, keeps the order fully determinate.
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

/** `strftime(...)`, matching the column defaults; an update stamps it by hand. */
const nowUtc = sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

export function recipes(db: Database) {
  const dz = orm(db);
  const units = unitRepository(db);
  const foods = foodRepository(db);
  const aisles = aisleRepository(db);
  const tags = tagRepository(db);

  // --- Reads ---------------------------------------------------------------

  const selectTags = (recipeId: string): Tag[] =>
    dz
      .select({ id: tag.id, name: tag.name, slug: tag.slug })
      .from(recipeTag)
      .innerJoin(tag, eq(tag.id, recipeTag.tagId))
      .where(eq(recipeTag.recipeId, recipeId))
      .orderBy(asc(tag.name))
      .all();

  const rowById = (id: string) => dz.select().from(recipe).where(eq(recipe.id, id)).get();

  // --- Reference resolution ------------------------------------------------
  // By id when that row exists, else by name (NOCASE), else a new row copying
  // the document's attributes. The id the caller sent is not kept for new rows.

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

  // --- Document assembly ---------------------------------------------------

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
      notes,
      tags: selectTags(row.id),
      parts,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  function summarise(row: SummaryRow): RecipeSummary {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      image: row.image,
      rating: row.rating,
      prepTime: row.prepMinutes,
      performTime: row.cookMinutes,
      totalTime: totalMinutes(row.prepMinutes, row.cookMinutes),
      lastMade: row.lastMade,
      favourite: row.favourite,
      tags: selectTags(row.id),
    };
  }

  function getById(id: string): Recipe | null {
    const row = rowById(id);
    return row ? assemble(row) : null;
  }

  // --- Write ---------------------------------------------------------------

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

  /** Delete every child row and re-insert them from the document. */
  function writeChildren(tx: Executor, recipeId: string, doc: ParsedRecipeInput): void {
    // Steps and ingredients cascade from the part, and step links cascade from both.
    tx.delete(recipeTag).where(eq(recipeTag.recipeId, recipeId)).run();
    tx.delete(recipeNote).where(eq(recipeNote.recipeId, recipeId)).run();
    tx.delete(part).where(eq(part.recipeId, recipeId)).run(); // steps, ingredients and their links cascade

    for (const t of doc.tags) {
      tx.insert(recipeTag).values({ recipeId, tagId: resolveTag(t) }).onConflictDoNothing().run();
    }

    doc.notes.forEach((note, position) => {
      tx.insert(recipeNote)
        .values({ id: note.id ?? crypto.randomUUID(), recipeId, position, title: note.title, text: note.text })
        .run();
    });

    doc.parts.forEach((p, position) => {
      const partId = p.id ?? crypto.randomUUID();
      tx.insert(part).values({ id: partId, recipeId, position, name: p.name }).run();
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
      // names an ingredient outside this part or names one twice (decisions.md
      // row 64). A saved recipe is never rejected over a stale link.
      p.steps.forEach((s, i) => {
        const stepId = s.id ?? crypto.randomUUID();
        tx.insert(step).values({ id: stepId, partId, position: i, text: s.text, image: s.image }).run();
        const seen = new Set<string>();
        for (const ingredientId of s.ingredientIds) {
          if (!linkable.has(ingredientId) || seen.has(ingredientId)) continue;
          seen.add(ingredientId);
          tx.insert(stepIngredient).values({ stepId, ingredientId, position: seen.size - 1 }).run();
        }
      });
    });
  }

  // --- Usage ---------------------------------------------------------------
  // Which recipes would notice if a reference row went away. Settings shows
  // these before a delete or a merge. Deleting the row itself is harmless in
  // SQL — every reference is ON DELETE SET NULL or CASCADE — so the point is
  // to say what changes, not to block. A recipe is listed once however many
  // of its rows use the reference, and the order matches the list page's
  // secondary sort: name, case-insensitively.

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
     * (M23.7). One query behind the import's "you already have this" warning,
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
     * (M34.3). The same warning as `bySourceUrl`, for an import that has no
     * address to compare — a Mealie export carries a name and often nothing
     * else. Matched case-insensitively, as the name sort is.
     */
    byName(name: string): { name: string; slug: string } | null {
      const wanted = name.trim();
      if (wanted === "") return null;
      const row = dz
        .select({ name: recipe.name, slug: recipe.slug })
        .from(recipe)
        .where(sql`${recipe.name} = ${wanted} COLLATE NOCASE`)
        .get();
      return row ?? null;
    },

    /**
     * Card summaries, newest first by default (M12.4: `sort`/`dir` change
     * that, see `resolveSort`; `sort: "random"` shuffles by `seed` instead,
     * see `seededOrder`). `q` is a name substring; `tag` and `tags` (tag
     * slugs) are combined and de-duplicated, then matched by `match` (any,
     * the default, or all); `foods` (food ids) matches any ingredient using
     * one of them; `favourite` true restricts to favourites.
     */
    list(filter: ListFilter = {}): RecipeSummary[] {
      const q = filter.q?.trim() || null;
      const tagSlugs = [
        ...new Set([filter.tag, ...(filter.tags ?? [])].map((t) => t?.trim()).filter((t): t is string => Boolean(t))),
      ];
      const foodIds = [...new Set((filter.foods ?? []).map((f) => f.trim()).filter(Boolean))];
      const match = filter.match ?? "any";

      /** Recipes carrying the tag whose slug satisfies `slugs`. */
      const hasTag = (slugs: SQL) =>
        exists(
          dz
            .select({ one: sql`1` })
            .from(recipeTag)
            .innerJoin(tag, eq(tag.id, recipeTag.tagId))
            .where(and(eq(recipeTag.recipeId, recipe.id), slugs)),
        );

      const clauses: (SQL | undefined)[] = [];

      if (q) clauses.push(sql`instr(lower(${recipe.name}), lower(${q})) > 0`);

      if (tagSlugs.length > 0) {
        if (match === "all") for (const slug of tagSlugs) clauses.push(hasTag(eq(tag.slug, slug)));
        else clauses.push(hasTag(inArray(tag.slug, tagSlugs)));
      }

      if (foodIds.length > 0) {
        clauses.push(
          exists(
            dz
              .select({ one: sql`1` })
              .from(part)
              .innerJoin(ingredient, eq(ingredient.partId, part.id))
              .where(and(eq(part.recipeId, recipe.id), inArray(ingredient.foodId, foodIds))),
          ),
        );
      }

      if (filter.favourite) clauses.push(eq(recipe.favourite, true));

      const where = clauses.length > 0 ? and(...clauses) : undefined;
      const { key: sort, dir } = resolveSort(filter.sort, filter.dir);
      const query = dz.select(summaryColumns).from(recipe).where(where);

      if (sort === "random") return seededOrder(query.all(), filter.seed ?? "").map(summarise);
      return query
        .orderBy(...orderClause(sort, dir))
        .all()
        .map(summarise);
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
      dz
        .update(recipe)
        .set({ rating, updatedAt: nowUtc })
        .where(eq(recipe.id, id))
        .returning({ id: recipe.id })
        .all().length > 0,

    /** Set the image file name alone (null clears it). Nothing else changes. True when `id` exists. */
    setImage: (id: string, image: string | null): boolean =>
      dz
        .update(recipe)
        .set({ image, updatedAt: nowUtc })
        .where(eq(recipe.id, id))
        .returning({ id: recipe.id })
        .all().length > 0,

    /**
     * Set one step's image file name (null clears it), leaving the recipe's
     * `updated_at` alone: the photo is stored beside the document, not by it,
     * and the document keeps the name so the next save re-inserts it (M35.1).
     * True when the step exists.
     */
    setStepImage: (stepId: string, image: string | null): boolean =>
      dz
        .update(step)
        .set({ image })
        .where(eq(step.id, stepId))
        .returning({ id: step.id })
        .all().length > 0,

    /** Does a step row exist? What the upload route asks before writing a file. */
    stepExists: (stepId: string): boolean => dz.select({ id: step.id }).from(step).where(eq(step.id, stepId)).all().length > 0,

    /**
     * The link-and-scale facts an ingredient row needs about the recipes its
     * foods point at (M32.3): the slug to link to, and the yield to derive a
     * servings hint from. One query and its unit lookups, rather than a read
     * per row; unknown ids are simply absent from the answer.
     */
    subRecipes(ids: readonly string[]): SubRecipe[] {
      const wanted = [...new Set(ids)];
      if (wanted.length === 0) return [];
      const unitCache = new Map<string, Unit | null>();
      return dz
        .select({
          id: recipe.id,
          slug: recipe.slug,
          name: recipe.name,
          recipeServings: recipe.servings,
          recipeYieldQuantity: recipe.yieldQuantity,
          yieldUnitId: recipe.yieldUnitId,
        })
        .from(recipe)
        .where(inArray(recipe.id, wanted))
        .orderBy(byName)
        .all()
        .map(({ yieldUnitId, ...rest }) => ({ ...rest, yieldUnit: readUnit(yieldUnitId, unitCache) }));
    },

    /** Summaries of the recipes with an ingredient of this food, by name. Empty when nothing uses it. */
    usingFood: (foodId: string): RecipeSummary[] =>
      dz
        .selectDistinct(summaryColumns)
        .from(recipe)
        .innerJoin(part, eq(part.recipeId, recipe.id))
        .innerJoin(ingredient, eq(ingredient.partId, part.id))
        .where(eq(ingredient.foodId, foodId))
        .orderBy(byName)
        .all()
        .map(summarise),

    /** Summaries of the recipes measuring an ingredient, or their yield, in this unit, by name. */
    usingUnit: (unitId: string): RecipeSummary[] =>
      dz
        .select(summaryColumns)
        .from(recipe)
        // A unit reaches a recipe two ways: an ingredient amount, or the yield.
        .where(
          sql`${recipe.yieldUnitId} = ${unitId} OR ${exists(
            dz
              .select({ one: sql`1` })
              .from(part)
              .innerJoin(ingredient, eq(ingredient.partId, part.id))
              .where(and(eq(part.recipeId, recipe.id), eq(ingredient.unitId, unitId))),
          )}`,
        )
        .orderBy(byName)
        .all()
        .map(summarise),

    /** Summaries of the recipes carrying this tag, by name. */
    usingTag: (tagId: string): RecipeSummary[] =>
      dz
        .select(summaryColumns)
        .from(recipe)
        .innerJoin(recipeTag, eq(recipeTag.recipeId, recipe.id))
        .where(eq(recipeTag.tagId, tagId))
        .orderBy(byName)
        .all()
        .map(summarise),

    /** True when a recipe was deleted. Children cascade; references stay. */
    remove: (id: string): boolean =>
      dz.delete(recipe).where(eq(recipe.id, id)).returning({ id: recipe.id }).all().length > 0,
  };
}

export type RecipeRepository = ReturnType<typeof recipes>;
