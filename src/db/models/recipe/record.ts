import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { type ParsedRecipeInput, type Recipe, type SubRecipe, suggestLinks } from "../../../domain/recipe";
import type { Unit } from "../../../domain/reference";
import type { Db, Executor } from "../../connection/client";
import { nowUtc } from "../columns";
import type { FoodRepository } from "../food/repo";
import { food } from "../food/schema";
import { ingredient, part, recipe, type SourcePart, step, stepIngredient } from "./schema";

/** What the repository lends a record: its handle and the document read and write it already knows how to do. */
export type RecipeStorage = {
  dz: Db;
  foods: FoodRepository;
  rowById: (id: string) => typeof recipe.$inferSelect | undefined;
  getById: (id: string) => Recipe | null;
  readUnit: (id: string | null, cache: Map<string, Unit | null>) => Unit | null;
  slugFor: (name: string, ownId: string) => string;
  recipeValues: (doc: ParsedRecipeInput) => Partial<typeof recipe.$inferInsert>;
  writeChildren: (tx: Executor, recipeId: string, doc: ParsedRecipeInput) => void;
};

/**
 * One recipe by id, and everything done to it. Bound, not loaded: each method
 * goes to the database with the id, so two records for one id cannot disagree.
 * Callers that never hold the document (a heart tap on a card, a rating on the
 * page, an upload route) reach these through `recipes.ref(id)`.
 */
export function recipeRecord({ dz, foods, rowById, getById, readUnit, slugFor, recipeValues, writeChildren }: RecipeStorage, id: string) {
  /** The part ids of this recipe: what scopes a step-keyed operation to it. */
  const ownParts = () => dz.select({ id: part.id }).from(part).where(eq(part.recipeId, id));

  // ===========================================================================
  // Steps alone: what a restyle touches. Not a document write — it swaps a
  // part's steps and nothing else, so it does not go through `replace`, which
  // would want a whole recipe and rewrite ingredients, notes and tags on the way.
  // ===========================================================================

  /** The recipe's parts in position order, with whatever original content they kept. */
  function partRows() {
    return dz.select({ id: part.id, name: part.name, sourcePart: part.sourcePart }).from(part).where(eq(part.recipeId, id)).orderBy(asc(part.position)).all();
  }

  /** One part as it stands: what `source_part` is made of, and what a restore puts back. */
  function partContent(partId: string): SourcePart {
    const steps = dz
      .select({ title: step.title, text: step.text, summary: step.summary })
      .from(step)
      .where(eq(step.partId, partId))
      .orderBy(asc(step.position))
      .all();
    const notes = dz
      .select({ note: ingredient.note })
      .from(ingredient)
      .where(eq(ingredient.partId, partId))
      .orderBy(asc(ingredient.position))
      .all()
      .map((row) => row.note);
    return { steps, notes };
  }

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
   * A step photo belongs to the step row it was attached to, and a rewrite may
   * merge two steps or split one, so there is no honest way to carry a photo
   * across: photos on replaced steps are lost. That is accepted — the restyle
   * is shown as a diff and approved before it runs.
   */
  function replacePart(tx: Executor, partId: string, content: SourcePart): void {
    tx.delete(step).where(eq(step.partId, partId)).run(); // links cascade from the step

    const rows = dz
      .select({ id: ingredient.id, foodId: ingredient.foodId })
      .from(ingredient)
      .where(eq(ingredient.partId, partId))
      .orderBy(asc(ingredient.position))
      .all();

    // The notes are positional: one per row, in the part's order. A shorter
    // answer leaves the rest alone rather than blanking them, which is what a
    // model that stopped early should cost.
    rows.forEach((row, index) => {
      const note = content.notes[index];
      if (note === undefined) return;
      tx.update(ingredient).set({ note }).where(eq(ingredient.id, row.id)).run();
    });

    const ingredients = rows.map((row) => ({ id: row.id, food: row.foodId === null ? null : (foods.get(row.foodId) ?? null) }));

    // The linker reads the label and the supporting line with the text: a row
    // named only in a step's label is still a row that step uses.
    const linked = suggestLinks({
      ingredients,
      steps: content.steps.map((s) => ({
        id: crypto.randomUUID(),
        text: [s.title, s.text, s.summary].filter((part) => part.trim() !== "").join(" "),
        ingredientIds: [] as string[],
      })),
    });

    linked.forEach((s, position) => {
      const written = content.steps[position]!;
      tx.insert(step).values({ id: s.id, partId, position, title: written.title, text: written.text, summary: written.summary, image: null }).run();
      s.ingredientIds.forEach((ingredientId, i) => {
        tx.insert(stepIngredient).values({ stepId: s.id, ingredientId, position: i }).run();
      });
    });
  }

  // ===========================================================================
  // The record.
  // ===========================================================================

  return {
    id,

    /**
     * Replace the recipe with `doc`, keeping its id, slug and created_at.
     * Children are deleted and re-inserted in the same transaction. Null when the id is unknown.
     */
    replace(doc: ParsedRecipeInput): Recipe | null {
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

    /** Set the favourite flag alone. Nothing else changes, `updated_at` included. True when the id exists. */
    favourite: (favourite: boolean): boolean => dz.update(recipe).set({ favourite }).where(eq(recipe.id, id)).returning({ id: recipe.id }).all().length > 0,

    /** Set the rating alone (null clears it), and touch `updated_at`. True when the id exists. */
    rate: (rating: number | null): boolean =>
      dz.update(recipe).set({ rating, updatedAt: nowUtc }).where(eq(recipe.id, id)).returning({ id: recipe.id }).all().length > 0,

    /** Set the image file name alone (null clears it), and touch `updated_at`. True when the id exists. */
    setImage: (image: string | null): boolean =>
      dz.update(recipe).set({ image, updatedAt: nowUtc }).where(eq(recipe.id, id)).returning({ id: recipe.id }).all().length > 0,

    /**
     * Replace every part's steps with the accepted restyle, keeping the
     * author's words. `parts` pairs with the recipe's parts by position, which
     * is how the restyle read verified them (`matchParts`), so a count that
     * does not match is a broken answer and throws rather than guessing which
     * part was meant. Null when the id is unknown.
     *
     * A part that has never been restyled has its current step texts copied
     * into `source_steps` first; one that already has them keeps what is
     * there, so "the original" stays the author's rather than becoming the
     * last rewrite. Then the steps themselves are replaced.
     */
    restyle(parts: readonly { name: string; notes: readonly string[]; steps: readonly { title: string; text: string; summary: string }[] }[]): Recipe | null {
      const current = rowById(id);
      if (!current) return null;
      const rows = partRows();
      if (rows.length !== parts.length) {
        throw new Error(`Restyle answered with ${parts.length} part${parts.length === 1 ? "" : "s"} where the recipe has ${rows.length}`);
      }
      dz.transaction((tx) => {
        rows.forEach((row, index) => {
          const answered = parts[index]!;
          const content: SourcePart = { steps: answered.steps.map((s) => ({ ...s })), notes: [...answered.notes] };
          const before = partContent(row.id);
          // An empty part answered with nothing was never sent to the model: leave it, or it would be stamped as restyled.
          if (content.steps.length === 0 && row.sourcePart === null && before.steps.length === 0) return;
          if (row.sourcePart === null) {
            tx.update(part).set({ sourcePart: before }).where(eq(part.id, row.id)).run();
          }
          replacePart(tx, row.id, content);
        });
        tx.update(recipe).set({ restyledAt: nowUtc, updatedAt: nowUtc }).where(eq(recipe.id, id)).run();
      });
      return getById(id);
    },

    /**
     * The author's steps of every part that has been restyled: part id to the
     * texts kept in `source_steps`. A part never restyled is absent, since its
     * steps are still the author's. What the restyle lab rebuilds a recipe
     * from, so a rewrite is always tried against the original words.
     */
    authorSteps(): Map<string, string[]> {
      return new Map(partRows().flatMap((row) => (row.sourcePart === null ? [] : [[row.id, row.sourcePart.steps.map((s) => s.text)] as const])));
    },

    /**
     * Put the author's words back: every part that kept `source_steps` has
     * them re-inserted as its steps, the column goes back to NULL, and the
     * recipe's stamp is cleared, so the page stops saying "Restyled" and a
     * later restyle starts from the original again. A part that was never
     * restyled is left exactly as it is. Null when the id is unknown; harmless
     * when nothing was restyled.
     */
    restore(): Recipe | null {
      const current = rowById(id);
      if (!current) return null;
      dz.transaction((tx) => {
        for (const row of partRows()) {
          if (row.sourcePart === null) continue;
          replacePart(tx, row.id, row.sourcePart);
          tx.update(part).set({ sourcePart: null }).where(eq(part.id, row.id)).run();
        }
        tx.update(recipe).set({ restyledAt: null, updatedAt: nowUtc }).where(eq(recipe.id, id)).run();
      });
      return getById(id);
    },

    // --- Steps, by step id ----------------------------------------------------
    // A step is addressed on its own by the photo upload; both ask only within
    // this recipe's parts, so a step id from another recipe is "not found".

    /** Does this recipe have that step? What the upload route asks before writing a file. */
    hasStep: (stepId: string): boolean =>
      dz
        .select({ id: step.id })
        .from(step)
        .where(and(eq(step.id, stepId), inArray(step.partId, ownParts())))
        .all().length > 0,

    /**
     * Set one step's image file name (null clears it), leaving the recipe's
     * `updated_at` alone: the photo is stored beside the document, not by it,
     * and the document keeps the name so the next save re-inserts it.
     * True when this recipe has the step.
     */
    setStepImage: (stepId: string, image: string | null): boolean =>
      dz
        .update(step)
        .set({ image })
        .where(and(eq(step.id, stepId), inArray(step.partId, ownParts())))
        .returning({ id: step.id })
        .all().length > 0,

    // --- Sub-recipes ------------------------------------------------------------

    /**
     * The recipes this recipe's ingredients are made by — each food's
     * `recipe_id`, followed — as the link-and-scale facts a row needs: the slug
     * to link to, and the yield to derive a servings hint from. One query for
     * the whole recipe, by name; a recipe with no sub-recipes gets an empty list.
     */
    subRecipes(): SubRecipe[] {
      const unitCache = new Map<string, Unit | null>();
      const made = dz
        .select({ id: food.recipeId })
        .from(ingredient)
        .innerJoin(part, eq(part.id, ingredient.partId))
        .innerJoin(food, eq(food.id, ingredient.foodId))
        .where(and(eq(part.recipeId, id), isNotNull(food.recipeId)));
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
        .where(inArray(recipe.id, made))
        .orderBy(sql`${recipe.name} COLLATE NOCASE`)
        .all()
        .map(({ yieldUnitId, ...rest }) => ({ ...rest, yieldUnit: readUnit(yieldUnitId, unitCache) }));
    },
  };
}

export type RecipeRecord = ReturnType<typeof recipeRecord>;
