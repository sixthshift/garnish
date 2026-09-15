// Recipe repository. Server-only; pass the Database opened by openDatabase.
// Reads and writes exactly the document in src/domain/recipe/recipe.ts.
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
import { type Ingredient, type ParsedRecipeInput, type Part, type Recipe, type RecipeNote, type RecipeSummary, type Step, resolveSort, type SortDir, type SortKey, suggestLinks, type SubRecipe } from "../../../domain/recipe";
import type { Food, Tag, Unit } from "../../../domain/reference";
import { formatIngredient, totalMinutes } from "../../../domain/ingredient";
import { seededOrder } from "../../../lib/lists";
import { aisles as aisleRepository } from "../aisle/repo";
import { type Executor, orm } from "../../connection/client";
import { food } from "../food/schema";
import { foods as foodRepository } from "../food/repo";
import { slugify, uniqueSlug } from "../../../lib/names";
import { tag } from "../tag/schema";
import { ingredient, part, recipe, recipeNote, recipeTag, step, stepIngredient } from "./schema";
import { tags as tagRepository } from "../tag/repo";
import { unit } from "../unit/schema";
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

  /** How many ingredient lines a card's hover preview shows (M35.3). */
  const INGREDIENT_PREVIEW_LIMIT = 6;

  /**
   * The card's hover preview (M35.3): the recipe's first `INGREDIENT_PREVIEW_LIMIT`
   * ingredient lines, part order then row order, formatted the same way the
   * recipe page's rows are (domain/ingredient/format.ts's formatIngredient).
   */
  const selectIngredientPreview = (recipeId: string): string[] =>
    dz
      .select({
        quantity: ingredient.quantity,
        note: ingredient.note,
        originalText: ingredient.originalText,
        unitName: unit.name,
        unitPluralName: unit.pluralName,
        unitAbbreviation: unit.abbreviation,
        unitUseAbbreviation: unit.useAbbreviation,
        unitFraction: unit.fraction,
        foodName: food.name,
        foodPluralName: food.pluralName,
      })
      .from(ingredient)
      .innerJoin(part, eq(part.id, ingredient.partId))
      .leftJoin(unit, eq(unit.id, ingredient.unitId))
      .leftJoin(food, eq(food.id, ingredient.foodId))
      .where(eq(part.recipeId, recipeId))
      .orderBy(asc(part.position), asc(ingredient.position))
      .limit(INGREDIENT_PREVIEW_LIMIT)
      .all()
      .map((row) =>
        formatIngredient({
          quantity: row.quantity,
          unit:
            row.unitName === null
              ? null
              : {
                  name: row.unitName,
                  pluralName: row.unitPluralName,
                  abbreviation: row.unitAbbreviation!,
                  useAbbreviation: row.unitUseAbbreviation!,
                  fraction: row.unitFraction!,
                },
          food: row.foodName === null ? null : { name: row.foodName, pluralName: row.foodPluralName },
          note: row.note,
          originalText: row.originalText,
        }),
      );

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
      restyledAt: row.restyledAt,
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
      ingredientPreview: selectIngredientPreview(row.id),
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
    // A part's kept original steps (M37.5) are not in the document, and a save
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
        .map((row) => [row.id, row.sourceSteps] as const),
    );

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

  // --- Restyle -------------------------------------------------------------
  // Replacing a part's steps with rewritten ones (M37.5). Not a document
  // write: the restyle touches steps and nothing else, so it goes through
  // these rather than through `update`, which would want a whole recipe and
  // would rewrite ingredients, notes and tags on the way past.

  /** A recipe's parts in position order, with whatever original steps they kept. */
  const partRows = (recipeId: string) =>
    dz
      .select({ id: part.id, name: part.name, sourceSteps: part.sourceSteps })
      .from(part)
      .where(eq(part.recipeId, recipeId))
      .orderBy(asc(part.position))
      .all();

  /** One part's step texts in position order: what `source_steps` is made of. */
  const stepTexts = (partId: string): string[] =>
    dz
      .select({ text: step.text })
      .from(step)
      .where(eq(step.partId, partId))
      .orderBy(asc(step.position))
      .all()
      .map((row) => row.text);

  /**
   * Swap a part's steps for `texts`, in order, with fresh ids.
   *
   * The links go with them: a step row is deleted, so its `step_ingredient`
   * rows cascade away, and a new row has nothing pointing at it. The step card
   * would lose its ingredient rows if nothing put them back, so `suggestLinks`
   * runs over the part's ingredients and the new texts — the same matcher the
   * editor and the importer use, which is the best available answer for a
   * sentence nobody has linked by hand.
   *
   * A step photo (M35.1) belongs to the step row it was attached to, and a
   * rewrite may merge two steps or split one, so there is no honest way to
   * carry a photo across: photos on replaced steps are lost. That is accepted
   * — the restyle is shown as a diff and approved before it runs.
   */
  function replaceSteps(tx: Executor, partId: string, texts: readonly string[]): void {
    tx.delete(step).where(eq(step.partId, partId)).run(); // links cascade from the step

    const ingredients = dz
      .select({ id: ingredient.id, foodId: ingredient.foodId })
      .from(ingredient)
      .where(eq(ingredient.partId, partId))
      .orderBy(asc(ingredient.position))
      .all()
      .map((row) => ({ id: row.id, food: row.foodId === null ? null : (foods.get(row.foodId) ?? null) }));

    const linked = suggestLinks({
      ingredients,
      steps: texts.map((text) => ({ id: crypto.randomUUID(), text, ingredientIds: [] as string[] })),
    });

    linked.forEach((s, position) => {
      tx.insert(step).values({ id: s.id, partId, position, text: s.text, image: null }).run();
      s.ingredientIds.forEach((ingredientId, i) => {
        tx.insert(stepIngredient).values({ stepId: s.id, ingredientId, position: i }).run();
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

    /**
     * Replace every part's steps with the accepted restyle (M37.5), keeping
     * the author's words. `parts` pairs with the recipe's parts by position,
     * which is how the restyle read verified them (`matchParts`), so a count
     * that does not match is a broken answer and throws rather than guessing
     * which part was meant. Null when `id` is unknown.
     *
     * A part that has never been restyled has its current step texts copied
     * into `source_steps` first; one that already has them keeps what is
     * there, so "the original" stays the author's rather than becoming the
     * last rewrite. Then the steps themselves are replaced.
     */
    restyleParts(id: string, parts: readonly { name: string; steps: readonly string[] }[]): Recipe | null {
      const current = rowById(id);
      if (!current) return null;
      const rows = partRows(id);
      if (rows.length !== parts.length) {
        throw new Error(`Restyle answered with ${parts.length} part${parts.length === 1 ? "" : "s"} where the recipe has ${rows.length}`);
      }
      dz.transaction((tx) => {
        rows.forEach((row, index) => {
          if (row.sourceSteps === null) {
            tx.update(part).set({ sourceSteps: stepTexts(row.id) }).where(eq(part.id, row.id)).run();
          }
          replaceSteps(tx, row.id, parts[index]!.steps);
        });
        tx.update(recipe).set({ restyledAt: nowUtc, updatedAt: nowUtc }).where(eq(recipe.id, id)).run();
      });
      return getById(id);
    },

    /**
     * Put the author's words back (M37.5): every part that kept
     * `source_steps` has them re-inserted as its steps, the column goes back
     * to NULL, and the recipe's stamp is cleared, so the page stops saying
     * "Restyled" and a later restyle starts from the original again. A part
     * that was never restyled is left exactly as it is. Null when `id` is
     * unknown; harmless when nothing was restyled.
     */
    restoreParts(id: string): Recipe | null {
      const current = rowById(id);
      if (!current) return null;
      dz.transaction((tx) => {
        for (const row of partRows(id)) {
          if (row.sourceSteps === null) continue;
          replaceSteps(tx, row.id, row.sourceSteps);
          tx.update(part).set({ sourceSteps: null }).where(eq(part.id, row.id)).run();
        }
        tx.update(recipe).set({ restyledAt: null, updatedAt: nowUtc }).where(eq(recipe.id, id)).run();
      });
      return getById(id);
    },

    /** True when a recipe was deleted. Children cascade; references stay. */
    remove: (id: string): boolean =>
      dz.delete(recipe).where(eq(recipe.id, id)).returning({ id: recipe.id }).all().length > 0,
  };
}

export type RecipeRepository = ReturnType<typeof recipes>;
