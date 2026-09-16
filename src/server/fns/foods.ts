import { createServerFn } from "@tanstack/react-start";
import foods from "../../db/models/food/repo";
import recipes from "../../db/models/recipe/repo";
import { FoodConversions, FoodCreate, FoodMerge, FoodUpdate, IdInput, ListQuery, NameInput, RecipeFoodInput } from "../../domain/reference";
import { required } from "../core/errors";
import { notFoundMiddleware } from "../core/fn";

export const listFoods = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(ListQuery)
  .handler(async ({ data }) => foods.list(data.q));

export const createFood = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(FoodCreate)
  .handler(async ({ data }) => foods.create(data));

export const updateFood = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(FoodUpdate)
  .handler(async ({ data: { id, ...patch } }) => required(foods.update(id, patch), "food", id));

/**
 * This food's conversions, replaced wholesale. `updateFood`
 * carries them too; this is the call the conversions editor makes on its own.
 */
export const setFoodConversions = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(FoodConversions)
  .handler(async ({ data: { id, conversions } }) => required(foods.setConversions(id, conversions), "food", id));

/** Deletes and returns the row, as Mealie does. */
export const deleteFood = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(async ({ data }) => {
    const food = required(foods.get(data.id), "food", data.id);
    foods.remove(data.id);
    return food;
  });

/** The existing food with this name (case-insensitive), else a new one. */
export const findOrCreateFood = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(NameInput)
  .handler(async ({ data }) => foods.findOrCreate(data.name));

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
