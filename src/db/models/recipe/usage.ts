import { and, eq, exists, inArray, sql } from "drizzle-orm";
import type { RecipeSummary, SubRecipe } from "../../../domain/recipe";
import type { Unit } from "../../../domain/reference";
import type { RecipeContext } from "./context";
import { byName, summaryColumns } from "./list";
import type { Readers } from "./read";
import { ingredient, part, recipe, recipeTag } from "./schema";

export function usage({ dz }: RecipeContext, { readUnit, summarise }: Pick<Readers, "readUnit" | "summarise">) {
  /**
   * The link-and-scale facts an ingredient row needs about the recipes its
   * foods point at: the slug to link to, and the yield to derive a
   * servings hint from. One query and its unit lookups, rather than a read
   * per row; unknown ids are simply absent from the answer.
   */
  function subRecipes(ids: readonly string[]): SubRecipe[] {
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
  }

  // --- Usage ---------------------------------------------------------------
  // Which recipes would notice if a reference row went away. Settings shows
  // these before a delete or a merge. Deleting the row itself is harmless in
  // SQL — every reference is ON DELETE SET NULL or CASCADE — so the point is
  // to say what changes, not to block. A recipe is listed once however many
  // of its rows use the reference, and the order matches the list page's
  // secondary sort: name, case-insensitively.

  /** Summaries of the recipes with an ingredient of this food, by name. Empty when nothing uses it. */
  const usingFood = (foodId: string): RecipeSummary[] =>
    dz
      .selectDistinct(summaryColumns)
      .from(recipe)
      .innerJoin(part, eq(part.recipeId, recipe.id))
      .innerJoin(ingredient, eq(ingredient.partId, part.id))
      .where(eq(ingredient.foodId, foodId))
      .orderBy(byName)
      .all()
      .map(summarise);

  /** Summaries of the recipes measuring an ingredient, or their yield, in this unit, by name. */
  const usingUnit = (unitId: string): RecipeSummary[] =>
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
            .where(and(eq(part.recipeId, recipe.id), eq(ingredient.unitId, unitId)))
        )}`
      )
      .orderBy(byName)
      .all()
      .map(summarise);

  /** Summaries of the recipes carrying this tag, by name. */
  const usingTag = (tagId: string): RecipeSummary[] =>
    dz
      .select(summaryColumns)
      .from(recipe)
      .innerJoin(recipeTag, eq(recipeTag.recipeId, recipe.id))
      .where(eq(recipeTag.tagId, tagId))
      .orderBy(byName)
      .all()
      .map(summarise);

  return { subRecipes, usingFood, usingUnit, usingTag };
}
