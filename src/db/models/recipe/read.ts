import { asc, eq } from "drizzle-orm";
import { formatIngredient, totalMinutes } from "../../../domain/ingredient";
import type { Recipe, RecipeSummary } from "../../../domain/recipe";
import type { Food, Tag, Unit } from "../../../domain/reference";
import { food } from "../food/schema";
import { tag } from "../tag/schema";
import { unit } from "../unit/schema";
import { assembler } from "./assemble";
import type { RecipeContext } from "./context";
import type { SummaryRow } from "./list";
import { ingredient, part, recipe, recipeTag } from "./schema";

/** How many ingredient lines a card's hover preview shows. */
export const INGREDIENT_PREVIEW_LIMIT = 6;

export type Readers = ReturnType<typeof readers>;

export function readers(ctx: RecipeContext) {
  const { dz, units, foods, aisles } = ctx;

  const selectTags = (recipeId: string): Tag[] =>
    dz
      .select({ id: tag.id, name: tag.name, slug: tag.slug })
      .from(recipeTag)
      .innerJoin(tag, eq(tag.id, recipeTag.tagId))
      .where(eq(recipeTag.recipeId, recipeId))
      .orderBy(asc(tag.name))
      .all();

  /**
   * The card's hover preview: the recipe's first `INGREDIENT_PREVIEW_LIMIT`
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
        })
      );

  const rowById = (id: string) => dz.select().from(recipe).where(eq(recipe.id, id)).get();

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

  const assemble = assembler(ctx, { readUnit, readFood, selectTags });

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

  return { rowById, readUnit, assemble, summarise, getById };
}
