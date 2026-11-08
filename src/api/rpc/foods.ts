import { createServerFn } from "@tanstack/react-start";
import foods from "../../db/models/food/repo";
import recipes from "../../db/models/recipe/repo";
import { FoodCreate, FoodMerge, FoodPacks, FoodUpdate, IdInput, ListQuery, RecipeFoodInput } from "../../domain/recipes/reference";
import { required } from "../../server/core/errors";
import { notFoundMiddleware } from "../../server/core/fn";

export const listFoods = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(ListQuery)
  .handler(async ({ data }) => foods.list(data.q));

/** How many recipes use each food, for Settings › Foods' Recipes column. */
export const listFoodUsage = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .handler(async () => foods.usage());

/** Every food as a summary: the home filter's vocabulary, without the rows' conversions and aliases. */
export const listFoodSummaries = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .handler(async () => foods.summaries());

export const createFood = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(FoodCreate)
  .handler(async ({ data }) => foods.create(data));

export const updateFood = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(FoodUpdate)
  .handler(async ({ data: { id, ...patch } }) => required(foods.update(id, patch), "food", id));

/** Every size every food is sold in: what the shopping list rounds a line up to (decisions.md row 184). */
export const listFoodPacks = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .handler(async () => foods.packs());

/** This food's sizes, replaced wholesale: the food editor's "Sold in", and the list's own. */
export const setFoodPacks = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(FoodPacks)
  .handler(async ({ data: { id, packs } }) => required(foods.setPacks(id, packs), "food", id));

/** Deletes and returns the row, as Mealie does. */
export const deleteFood = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(async ({ data }) => {
    const food = required(foods.get(data.id), "food", data.id);
    foods.remove(data.id);
    return food;
  });

/**
 * The food this recipe is: the existing food of
 * the recipe's name, or a new one, with `recipeId` pointing back at the
 * recipe. Idempotent — running it twice on the same recipe returns the same
 * food, which is what "create or link" means. Not-found when the recipe is
 * unknown.
 */
export const foodForRecipe = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(RecipeFoodInput)
  .handler(async ({ data }) => {
    const recipe = required(recipes.getById(data.recipeId), "recipe", data.recipeId);
    const food = foods.findOrCreate(recipe.name);
    if (food.recipeId === recipe.id) return food;
    return required(foods.update(food.id, { recipeId: recipe.id }), "food", food.id);
  });

/** The recipes with an ingredient of this food, for the delete/merge confirm dialogs. */
export const usingFood = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(async ({ data }) => recipes.query({ by: "food", id: data.id }));

/**
 * Merge `sourceId` into `targetId`: every ingredient using the source is
 * repointed to the target, then the source is deleted, in one transaction.
 * Not-found when either id is unknown.
 */
export const mergeFood = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(FoodMerge)
  .handler(async ({ data: { sourceId, targetId } }) => {
    required(foods.get(sourceId), "food", sourceId);
    required(foods.get(targetId), "food", targetId);
    return required(foods.merge(sourceId, targetId), "food", targetId);
  });
