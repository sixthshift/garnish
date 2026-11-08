import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { type Facets, type ParsedRecipeInput, type Recipe, type SubRecipe, suggestLinks } from "../../../domain/recipes/recipe";
import { placesEveryRow } from "../../../domain/recipes/style";
import type { Db, Executor } from "../../connection/client";
import { nowUtc } from "../columns";
import type { FoodRepository } from "../food/repo";
import { food } from "../food/schema";
import type { ReferenceReader } from "../references";
import { writeFacets } from "./facets";
import { ingredient, part, recipe, type SourcePart, step, stepIngredient } from "./schema";

/** What the repository lends a record: its handle and the document read and write it already knows how to do. */
export type RecipeStorage = {
  dz: Db;
  foods: FoodRepository;
  rowById: (id: string) => typeof recipe.$inferSelect | undefined;
  getById: (id: string) => Recipe | null;
  /** A fresh reader of unit and food ids, one per document read. */
  references: () => ReferenceReader;
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
export function recipeRecord({ dz, foods, rowById, getById, references, slugFor, recipeValues, writeChildren }: RecipeStorage, id: string) {
  /** The part ids of this recipe: what scopes a step-keyed operation to it. */
  const ownParts = () => dz.select({ id: part.id }).from(part).where(eq(part.recipeId, id));

  // ===========================================================================
  // The layout: what a restyle touches. Not a document write — it lays the
  // recipe's existing rows out in parts and swaps the steps, and nothing else,
  // so it does not go through `replace`, which would want a whole recipe and
  // rewrite quantities, alternatives, notes and tags on the way.
  // ===========================================================================

  /** The recipe's parts in position order. */
  function partRows() {
    return dz.select({ id: part.id, name: part.name }).from(part).where(eq(part.recipeId, id)).orderBy(asc(part.position)).all();
  }

  /** The recipe's ingredient rows, part by part in position order: what a restyle's row numbers count through. */
  function rowsInOrder() {
    return dz
      .select({ id: ingredient.id, partId: ingredient.partId, note: ingredient.note, foodId: ingredient.foodId })
      .from(ingredient)
      .innerJoin(part, eq(part.id, ingredient.partId))
      .where(eq(part.recipeId, id))
      .orderBy(asc(part.position), asc(ingredient.position))
      .all();
  }

  /** The recipe as it stands, in the shape `source_parts` keeps: what a first restyle saves, so a restore can put it back. */
  function currentLayout(): SourcePart[] {
    const rows = rowsInOrder();
    return partRows().map((row) => {
      const own = rows.filter((r) => r.partId === row.id);
      const steps = dz
        .select({ title: step.title, text: step.text, summary: step.summary })
        .from(step)
        .where(eq(step.partId, row.id))
        .orderBy(asc(step.position))
        .all();
      return { name: row.name, rows: own.map((r) => r.id), notes: own.map((r) => r.note), steps };
    });
  }

  /**
   * Lay the recipe out as `layout`: its parts in that order under those names,
   * each holding those rows with those notes, and those steps with fresh ids.
   * Every row of the recipe must be in `layout` exactly once — a part left
   * with a row in it would take the row with it when it goes — which the
   * callers make sure of.
   *
   * A part keeps its id where one of the old parts has its name, then where
   * one is still unused, so a restyle that only rewrote steps leaves every
   * part as it was; a part left over is deleted. Rows keep their ids, so their
   * quantities, alternatives and shopping history stay theirs.
   *
   * The links are made again: a step row is deleted, so its `step_ingredient`
   * rows cascade away, and `suggestLinks` runs over each part's new steps with
   * the whole recipe's rows — the same matcher the editor and the importer use, which is the
   * best available answer for a sentence nobody has linked by hand. A step
   * photo belongs to the step row it was attached to, and a rewrite may merge
   * two steps or split one, so there is no honest way to carry a photo across:
   * photos on replaced steps are lost. That is accepted — the restyle is shown
   * on the Style page and saved by a press.
   */
  function layOut(tx: Executor, layout: readonly SourcePart[]): void {
    const old = partRows();
    const fold = (name: string) => name.trim().toLowerCase();
    const free = new Set(old.map((row) => row.id));
    const byName = layout.map((entry) => {
      const match = old.find((row) => free.has(row.id) && fold(row.name) === fold(entry.name));
      if (match) free.delete(match.id);
      return match?.id;
    });
    const partIds = byName.map((matched) => {
      if (matched !== undefined) return matched;
      const reused = old.find((row) => free.has(row.id));
      if (reused === undefined) return crypto.randomUUID();
      free.delete(reused.id);
      return reused.id;
    });

    // Positions are unique within a recipe and within a part, so everything
    // steps aside to a negative place first and then takes its own.
    for (const [i, row] of old.entries())
      tx.update(part)
        .set({ position: -(i + 1) })
        .where(eq(part.id, row.id))
        .run();
    for (const [i, row] of rowsInOrder().entries())
      tx.update(ingredient)
        .set({ position: -(i + 1) })
        .where(eq(ingredient.id, row.id))
        .run();

    layout.forEach((entry, position) => {
      const partId = partIds[position]!;
      if (old.some((row) => row.id === partId)) tx.update(part).set({ position, name: entry.name }).where(eq(part.id, partId)).run();
      else tx.insert(part).values({ id: partId, recipeId: id, position, name: entry.name }).run();
      entry.rows.forEach((rowId, i) => {
        tx.update(ingredient)
          .set({ partId, position: i, note: entry.notes[i] ?? "" })
          .where(eq(ingredient.id, rowId))
          .run();
      });
    });
    for (const partId of free) tx.delete(part).where(eq(part.id, partId)).run(); // its steps cascade; its rows have all moved

    const rows = new Map(rowsInOrder().map((row) => [row.id, row]));
    const laidOut = layout.map((entry) =>
      entry.rows.map((rowId) => {
        const foodId = rows.get(rowId)?.foodId ?? null;
        return { id: rowId, food: foodId === null ? null : (foods.get(foodId) ?? null) };
      })
    );
    layout.forEach((entry, position) => {
      const partId = partIds[position]!;
      tx.delete(step).where(eq(step.partId, partId)).run(); // links cascade from the step
      // The linker reads the label and the supporting line with the text: a row
      // named only in a step's label is still a row that step uses. Its own
      // part's rows first, then the rest of the recipe's (decisions.md row 228).
      const linked = suggestLinks(
        {
          ingredients: laidOut[position]!,
          steps: entry.steps.map((s) => ({
            id: crypto.randomUUID(),
            text: [s.title, s.text, s.summary].filter((text) => text.trim() !== "").join(" "),
            ingredientIds: [] as string[],
          })),
        },
        laidOut.flatMap((own, i) => (i === position ? [] : own))
      );
      linked.forEach((s, stepPosition) => {
        const written = entry.steps[stepPosition]!;
        tx.insert(step)
          .values({ id: s.id, partId, position: stepPosition, title: written.title, text: written.text, summary: written.summary, image: null })
          .run();
        s.ingredientIds.forEach((ingredientId, i) => {
          tx.insert(stepIngredient).values({ stepId: s.id, ingredientId, position: i }).run();
        });
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

    /**
     * Set the facets alone, every layer (an empty layer clears it). Nothing
     * else changes, `updated_at` included, as with the favourite flag. True when the id exists.
     */
    facets: (facets: Facets): boolean => {
      if (!rowById(id)) return false;
      dz.transaction((tx) => writeFacets(tx, id, facets));
      return true;
    },

    /** Set the rating alone (null clears it), and touch `updated_at`. True when the id exists. */
    rate: (rating: number | null): boolean =>
      dz.update(recipe).set({ rating, updatedAt: nowUtc }).where(eq(recipe.id, id)).returning({ id: recipe.id }).all().length > 0,

    /** Set the image file name alone (null clears it), and touch `updated_at`. True when the id exists. */
    setImage: (image: string | null): boolean =>
      dz.update(recipe).set({ image, updatedAt: nowUtc }).where(eq(recipe.id, id)).returning({ id: recipe.id }).all().length > 0,

    /**
     * Lay the recipe out as the accepted restyle: `parts` in their order, each
     * holding the rows it names — by their place in the recipe's rows read
     * part by part from 0 — with a note each, and its steps. Every row must be
     * named exactly once; anything else is a broken answer and throws rather
     * than guessing where a row was meant to go. Null when the id is unknown.
     *
     * The first restyle keeps the recipe as it stands in `source_parts`; a
     * later one leaves what is there, so "the original" stays the author's
     * rather than becoming the last rewrite.
     */
    restyle(
      parts: readonly { name: string; rows: readonly number[]; notes: readonly string[]; steps: readonly { title: string; text: string; summary: string }[] }[]
    ): Recipe | null {
      const current = rowById(id);
      if (!current) return null;
      const rows = rowsInOrder();
      if (!placesEveryRow(rows.length, parts)) {
        throw new Error(`The restyle does not place each of the recipe's ${rows.length} ingredient rows exactly once, so nothing was changed`);
      }
      dz.transaction((tx) => {
        if (current.sourceParts === null) tx.update(recipe).set({ sourceParts: currentLayout() }).where(eq(recipe.id, id)).run();
        layOut(
          tx,
          parts.map((p) => ({ name: p.name, rows: p.rows.map((row) => rows[row]!.id), notes: [...p.notes], steps: p.steps.map((s) => ({ ...s })) }))
        );
        tx.update(recipe).set({ restyledAt: nowUtc, updatedAt: nowUtc }).where(eq(recipe.id, id)).run();
      });
      return getById(id);
    },

    /**
     * The recipe's parts as the author left them, or null when it was never
     * restyled and they are the parts it has. What the restyle lab rebuilds a
     * recipe from, so a rewrite is always tried against the original.
     */
    authorParts(): SourcePart[] | null {
      return rowById(id)?.sourceParts ?? null;
    },

    /**
     * Put the author's recipe back: the parts as `source_parts` kept them,
     * their rows, notes and steps; the column goes back to NULL and the stamp
     * is cleared, so the page stops saying "Restyled" and a later restyle
     * starts from the original again. A row the recipe no longer has is
     * skipped; a part added since, under a new name and holding only new rows,
     * stays as it is at the end; and any other row added since goes to the
     * author's part of its part's name, or to the last. Null when the id is
     * unknown; harmless when nothing was restyled.
     */
    restore(): Recipe | null {
      const current = rowById(id);
      if (!current) return null;
      const kept = current.sourceParts;
      dz.transaction((tx) => {
        if (kept !== null && kept.length > 0) {
          const rows = rowsInOrder();
          const present = new Set(rows.map((row) => row.id));
          const layout = kept.map((entry) => {
            const at = entry.rows.flatMap((rowId, i) => (present.has(rowId) ? [i] : []));
            return { ...entry, rows: at.map((i) => entry.rows[i]!), notes: at.map((i) => entry.notes[i] ?? "") };
          });
          const placed = new Set(layout.flatMap((entry) => entry.rows));
          // A part added since the restyle — a name the author's recipe never had,
          // holding only rows it never had — is the household's, and stays as it is.
          const keptNames = new Set(layout.map((entry) => entry.name.trim().toLowerCase()));
          for (const added of currentLayout()) {
            if (keptNames.has(added.name.trim().toLowerCase()) || added.rows.some((rowId) => placed.has(rowId))) continue;
            layout.push(added);
            for (const rowId of added.rows) placed.add(rowId);
          }
          const names = new Map(partRows().map((row) => [row.id, row.name.trim().toLowerCase()]));
          for (const row of rows) {
            if (placed.has(row.id)) continue;
            const home = layout.find((entry) => entry.name.trim().toLowerCase() === names.get(row.partId)) ?? layout[layout.length - 1]!;
            home.rows.push(row.id);
            home.notes.push(row.note);
          }
          layOut(tx, layout);
        }
        tx.update(recipe).set({ sourceParts: null, restyledAt: null, updatedAt: nowUtc }).where(eq(recipe.id, id)).run();
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
      const refs = references();
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
        .map(({ yieldUnitId, ...rest }) => ({ ...rest, yieldUnit: refs.unit(yieldUnitId) }));
    },
  };
}

export type RecipeRecord = ReturnType<typeof recipeRecord>;
