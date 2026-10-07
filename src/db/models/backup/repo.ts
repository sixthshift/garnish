import type { Database } from "bun:sqlite";
import { asc, count, eq, isNotNull, max } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Backup, BackupCounts, BackupRecipe } from "../../../domain/backup";
import { imageFileOf, imagePath } from "../../../domain/backup";
import { lazy } from "../../../lib/lazy";
import { getDb } from "../../../server/core/db";
import { snapshot } from "../../backup/snapshot";
import { orm } from "../../connection/client";
import { aisle } from "../aisle/schema";
import { food, foodConversion } from "../food/schema";
import { mealPlanEntry } from "../plan/schema";
import { plannerRule } from "../planner/schema";
import { ingredient, part, recipe, recipeNote, recipeTag, step, stepIngredient } from "../recipe/schema";
import { shoppingItem, shoppingItemSource } from "../shopping/schema";
import { styleRule } from "../style/schema";
import { tag } from "../tag/schema";
import { lastMadeFrom } from "../timeline/repo";
import { timelineEvent } from "../timeline/schema";
import { unit } from "../unit/schema";

/** Rows by a key, each group in the rows' order. */
function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const group = groups.get(k);
    if (group) group.push(row);
    else groups.set(k, [row]);
  }
  return groups;
}

/** A backup's data without its envelope: what the database holds and a restore puts back. */
export type BackupBody = Omit<Backup, "garnish">;

/**
 * The household's data as one thing (decisions.md row 131): read whole into the
 * backup's shape, or replaced whole by one. It is the one repository that
 * spans every domain's tables, because a backup and a restore are the one
 * operation that does. The push tables, `migration` and `seed_batch` are not
 * the household's and it never touches them.
 */
export function backupRepository(db: Database) {
  const dz = orm(db);

  /** Every recipe in the backup's shape, by name, with its children in their order. */
  function readRecipes(): BackupRecipe[] {
    const recipes = dz.select().from(recipe).orderBy(asc(recipe.name), asc(recipe.id)).all();
    const notes = groupBy(dz.select().from(recipeNote).orderBy(asc(recipeNote.position)).all(), (row) => row.recipeId);
    const tags = groupBy(
      dz
        .select({ recipeId: recipeTag.recipeId, tagId: recipeTag.tagId, name: tag.name })
        .from(recipeTag)
        .innerJoin(tag, eq(tag.id, recipeTag.tagId))
        .orderBy(asc(tag.name))
        .all(),
      (row) => row.recipeId
    );
    const parts = groupBy(dz.select().from(part).orderBy(asc(part.position)).all(), (row) => row.recipeId);
    const ingredients = groupBy(dz.select().from(ingredient).orderBy(asc(ingredient.position)).all(), (row) => row.partId);
    const steps = groupBy(dz.select().from(step).orderBy(asc(step.position)).all(), (row) => row.partId);
    const links = groupBy(dz.select().from(stepIngredient).orderBy(asc(stepIngredient.position)).all(), (row) => row.stepId);

    return recipes.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      image: imagePath("recipe", row.image),
      rating: row.rating,
      favourite: row.favourite,
      recipeServings: row.servings,
      recipeYieldQuantity: row.yieldQuantity,
      yieldUnitId: row.yieldUnitId,
      recipeYield: row.yieldText,
      prepTime: row.prepMinutes,
      performTime: row.cookMinutes,
      sourceUrl: row.sourceUrl,
      tagIds: (tags.get(row.id) ?? []).map((link) => link.tagId),
      notes: (notes.get(row.id) ?? []).map((note) => ({ id: note.id, title: note.title, text: note.text })),
      parts: (parts.get(row.id) ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        ingredients: (ingredients.get(p.id) ?? []).map((i) => ({
          id: i.id,
          quantity: i.quantity,
          unitId: i.unitId,
          foodId: i.foodId,
          note: i.note,
          originalText: i.originalText,
          fixed: i.fixed,
        })),
        steps: (steps.get(p.id) ?? []).map((s) => ({
          id: s.id,
          title: s.title,
          text: s.text,
          summary: s.summary,
          ingredientIds: (links.get(s.id) ?? []).map((link) => link.ingredientId),
          image: imagePath("step", s.image),
        })),
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  /** The stored file name a backup path names; the schema has already held it to its folder. */
  const fileOf = (kind: "recipe" | "step" | "timeline", path: string | null): string | null => (path === null ? null : imageFileOf(kind, path));

  /** Empty every household table. Children first, so no cascade is relied on. */
  function clear(tx: ReturnType<typeof orm>): void {
    for (const table of [
      shoppingItemSource,
      shoppingItem,
      mealPlanEntry,
      timelineEvent,
      stepIngredient,
      step,
      ingredient,
      part,
      recipeNote,
      recipeTag,
      foodConversion,
      food,
      recipe,
      unit,
      aisle,
      tag,
      styleRule,
      plannerRule,
    ])
      tx.delete(table).run();
  }

  return {
    /**
     * Everything the household made, in the backup's shape and its stable order
     * (by position where there is one, else name, else date; ids break ties),
     * so two reads of one database are equal. Images are paths in the backup.
     */
    read(): BackupBody {
      const conversions = groupBy(
        dz.select().from(foodConversion).orderBy(asc(foodConversion.unitId), asc(foodConversion.toUnitId)).all(),
        (row) => row.foodId
      );
      const sources = groupBy(dz.select().from(shoppingItemSource).orderBy(asc(shoppingItemSource.id)).all(), (row) => row.itemId);
      const rule = (row: typeof styleRule.$inferSelect) => ({
        id: row.id,
        position: row.position,
        text: row.text,
        enabled: row.enabled,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });

      return {
        aisles: dz.select().from(aisle).orderBy(asc(aisle.position), asc(aisle.name), asc(aisle.id)).all(),
        units: dz
          .select()
          .from(unit)
          .orderBy(asc(unit.name), asc(unit.id))
          .all()
          .map((row) => ({
            id: row.id,
            name: row.name,
            pluralName: row.pluralName,
            abbreviation: row.abbreviation,
            useAbbreviation: row.useAbbreviation,
            fraction: row.fraction,
            portion: row.portion,
            standardQuantity: row.standardQuantity,
            standardUnitId: row.standardUnitId,
          })),
        tags: dz.select().from(tag).orderBy(asc(tag.name), asc(tag.id)).all(),
        foods: dz
          .select()
          .from(food)
          .orderBy(asc(food.name), asc(food.id))
          .all()
          .map((row) => ({
            id: row.id,
            name: row.name,
            pluralName: row.pluralName,
            aliases: row.aliases,
            aisleId: row.aisleId,
            recipeId: row.recipeId,
            skipShopping: row.skipShopping,
            conversions: (conversions.get(row.id) ?? []).map((c) => ({
              id: c.id,
              unitId: c.unitId,
              quantity: c.quantity,
              toUnitId: c.toUnitId,
              toQuantity: c.toQuantity,
            })),
          })),
        recipes: readRecipes(),
        timeline: dz
          .select()
          .from(timelineEvent)
          .orderBy(asc(timelineEvent.occurredOn), asc(timelineEvent.createdAt), asc(timelineEvent.id))
          .all()
          .map((row) => ({
            id: row.id,
            recipeId: row.recipeId,
            occurredOn: row.occurredOn,
            message: row.message,
            image: imagePath("timeline", row.image),
            servings: row.servings,
            createdAt: row.createdAt,
          })),
        plan: dz
          .select()
          .from(mealPlanEntry)
          .orderBy(asc(mealPlanEntry.date), asc(mealPlanEntry.position), asc(mealPlanEntry.id))
          .all()
          .map((row) => ({
            id: row.id,
            date: row.date,
            position: row.position,
            meal: row.meal,
            recipeId: row.recipeId,
            text: row.text,
            servings: row.servings,
          })),
        shopping: dz
          .select()
          .from(shoppingItem)
          .orderBy(asc(shoppingItem.position), asc(shoppingItem.id))
          .all()
          .map((row) => ({
            id: row.id,
            position: row.position,
            quantity: row.quantity,
            unitId: row.unitId,
            foodId: row.foodId,
            text: row.text,
            ticked: row.ticked,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            sources: (sources.get(row.id) ?? []).map((s) => ({
              id: s.id,
              recipeId: s.recipeId,
              recipeName: s.recipeName,
              partName: s.partName,
              servings: s.servings,
              quantity: s.quantity,
            })),
          })),
        styleRules: dz.select().from(styleRule).orderBy(asc(styleRule.position), asc(styleRule.id)).all().map(rule),
        plannerRules: dz.select().from(plannerRule).orderBy(asc(plannerRule.position), asc(plannerRule.id)).all().map(rule),
      };
    },

    /** A `VACUUM INTO` copy of the whole database in `dir`, before a restore replaces it. Returns its path. */
    snapshot(dir: string, now: Date = new Date()): string {
      return snapshot(db, dir, now);
    },

    /** How many of each thing the database holds now: the "before" of the restore sheet. */
    counts(): BackupCounts {
      const rows = (table: SQLiteTable) => dz.select({ n: count() }).from(table).get()?.n ?? 0;
      const images =
        (dz.select({ n: count() }).from(recipe).where(isNotNull(recipe.image)).get()?.n ?? 0) +
        (dz.select({ n: count() }).from(step).where(isNotNull(step.image)).get()?.n ?? 0) +
        (dz.select({ n: count() }).from(timelineEvent).where(isNotNull(timelineEvent.image)).get()?.n ?? 0);
      return {
        recipes: rows(recipe),
        foods: rows(food),
        units: rows(unit),
        aisles: rows(aisle),
        tags: rows(tag),
        timeline: rows(timelineEvent),
        plan: rows(mealPlanEntry),
        shopping: rows(shoppingItem),
        styleRules: rows(styleRule),
        plannerRules: rows(plannerRule),
        images,
      };
    },

    /**
     * Replace the household's data with `body`, in one transaction: every
     * household table emptied, then the lists inserted in order with the two
     * back-references (`food.recipeId`, `unit.standardUnitId`) set once every
     * row exists. `recipe.lastMade` is derived again from the timeline; restyle
     * originals are not in a backup and stay null. Throws, leaving the
     * database as it was, on anything SQLite refuses — the caller checks the
     * body first (`checkBackup`), so that is a bug, not a bad file.
     */
    replace(body: BackupBody): void {
      dz.transaction((tx) => {
        clear(tx as unknown as ReturnType<typeof orm>);

        for (const row of body.aisles) tx.insert(aisle).values(row).run();
        for (const { standardUnitId: _, ...row } of body.units) tx.insert(unit).values(row).run();
        for (const row of body.tags) tx.insert(tag).values(row).run();
        for (const { conversions, recipeId: _, ...row } of body.foods) {
          tx.insert(food).values(row).run();
          for (const c of conversions)
            tx.insert(foodConversion)
              .values({ ...c, foodId: row.id })
              .run();
        }

        for (const r of body.recipes) {
          tx.insert(recipe)
            .values({
              id: r.id,
              slug: r.slug,
              name: r.name,
              description: r.description,
              image: fileOf("recipe", r.image),
              rating: r.rating,
              favourite: r.favourite,
              servings: r.recipeServings,
              yieldQuantity: r.recipeYieldQuantity,
              yieldUnitId: r.yieldUnitId,
              yieldText: r.recipeYield,
              prepMinutes: r.prepTime,
              cookMinutes: r.performTime,
              sourceUrl: r.sourceUrl,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
            })
            .run();
          for (const tagId of r.tagIds) tx.insert(recipeTag).values({ recipeId: r.id, tagId }).run();
          r.notes.forEach((note, position) => {
            tx.insert(recipeNote)
              .values({ ...note, recipeId: r.id, position })
              .run();
          });
          r.parts.forEach((p, partPosition) => {
            tx.insert(part).values({ id: p.id, recipeId: r.id, position: partPosition, name: p.name }).run();
            p.ingredients.forEach((i, position) => {
              tx.insert(ingredient)
                .values({ ...i, partId: p.id, position })
                .run();
            });
            p.steps.forEach(({ ingredientIds, image, ...s }, position) => {
              tx.insert(step)
                .values({ ...s, image: fileOf("step", image), partId: p.id, position })
                .run();
              ingredientIds.forEach((ingredientId, linkPosition) => {
                tx.insert(stepIngredient).values({ stepId: s.id, ingredientId, position: linkPosition }).run();
              });
            });
          });
        }

        for (const row of body.foods) if (row.recipeId) tx.update(food).set({ recipeId: row.recipeId }).where(eq(food.id, row.id)).run();
        for (const row of body.units) if (row.standardUnitId) tx.update(unit).set({ standardUnitId: row.standardUnitId }).where(eq(unit.id, row.id)).run();

        for (const { image, ...row } of body.timeline)
          tx.insert(timelineEvent)
            .values({ ...row, image: fileOf("timeline", image) })
            .run();
        const latest = tx
          .select({ recipeId: timelineEvent.recipeId, on: max(timelineEvent.occurredOn) })
          .from(timelineEvent)
          .groupBy(timelineEvent.recipeId)
          .all();
        for (const { recipeId, on } of latest)
          tx.update(recipe)
            .set({ lastMade: lastMadeFrom(on) })
            .where(eq(recipe.id, recipeId))
            .run();

        for (const row of body.plan) tx.insert(mealPlanEntry).values(row).run();
        for (const { sources, ...row } of body.shopping) {
          tx.insert(shoppingItem).values(row).run();
          for (const source of sources)
            tx.insert(shoppingItemSource)
              .values({ ...source, itemId: row.id })
              .run();
        }
        for (const row of body.styleRules) tx.insert(styleRule).values(row).run();
        for (const row of body.plannerRules) tx.insert(plannerRule).values(row).run();
      });
    },
  };
}

export type BackupRepository = ReturnType<typeof backupRepository>;

/** The repository over the application database. Tests and the CLIs build their own with `backupRepository(db)`. */
export default lazy(getDb, backupRepository);
