import { asc, eq } from "drizzle-orm";
import { formatIngredient, totalMinutes } from "../../../domain/ingredient";
import type { RecipeSummary } from "../../../domain/recipe";
import type { Tag } from "../../../domain/reference";
import type { Db } from "../../connection/client";
import { food } from "../food/schema";
import { tag } from "../tag/schema";
import { unit } from "../unit/schema";
import { ingredient, part, recipe, recipeTag } from "./schema";

// How a RecipeSummary is made from the recipe table: the columns a query
// selects, and the two small reads that finish each row. Pure over the handle.

/** How many ingredient lines a summary carries. */
export const INGREDIENT_PREVIEW_LIMIT = 6;

/** The recipe columns a summary needs. The shape `summarise` reads. */
export const summaryColumns = {
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

export type SummaryRow = Pick<
  typeof recipe.$inferSelect,
  "id" | "slug" | "name" | "image" | "rating" | "prepMinutes" | "cookMinutes" | "lastMade" | "favourite"
>;

/** A recipe's tags by name. Shared with document assembly. */
export function selectTags(dz: Db, recipeId: string): Tag[] {
  return dz
    .select({ id: tag.id, name: tag.name, slug: tag.slug })
    .from(recipeTag)
    .innerJoin(tag, eq(tag.id, recipeTag.tagId))
    .where(eq(recipeTag.recipeId, recipeId))
    .orderBy(asc(tag.name))
    .all();
}

/**
 * The recipe's first `INGREDIENT_PREVIEW_LIMIT` ingredient lines, part order
 * then row order, formatted the same way the recipe page's rows are.
 */
function selectIngredientPreview(dz: Db, recipeId: string): string[] {
  return dz
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
}

/** A summary from one row of `summaryColumns`, finished with its tags and ingredient preview. */
export function summarise(dz: Db, row: SummaryRow): RecipeSummary {
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
    tags: selectTags(dz, row.id),
    ingredientPreview: selectIngredientPreview(dz, row.id),
  };
}
