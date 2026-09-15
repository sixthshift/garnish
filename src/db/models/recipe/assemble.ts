import { asc, eq } from "drizzle-orm";
import type { Ingredient, Part, Recipe, RecipeNote, Step } from "../../../domain/recipe";
import type { Food, Tag, Unit } from "../../../domain/reference";
import type { RecipeContext } from "./context";
import { ingredient, part, type recipe, recipeNote, step, stepIngredient } from "./schema";

/** The reference reads assembly leans on, cached per document by the caller's maps. */
export type AssembleRefs = {
  readUnit: (id: string | null, cache: Map<string, Unit | null>) => Unit | null;
  readFood: (id: string | null, cache: Map<string, Food | null>) => Food | null;
  selectTags: (recipeId: string) => Tag[];
};

export function assembler({ dz }: RecipeContext, { readUnit, readFood, selectTags }: AssembleRefs) {
  return function assemble(row: typeof recipe.$inferSelect): Recipe {
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
  };
}
