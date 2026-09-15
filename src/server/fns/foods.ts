// Food server functions. Every id lookup that misses raises NotFound.
import { createServerFn } from "@tanstack/react-start";
import { foods } from "../../db/models/food/repo";
import { recipes } from "../../db/models/recipe/repo";
import { FoodConversions, FoodCreate, FoodMerge, FoodUpdate, IdInput, ListQuery, NameInput, RecipeFoodInput } from "../../domain/reference";
import { getDb } from "../core/db";
import { required } from "../core/errors";
import { notFoundMiddleware } from "../core/fn";

export const listFoods = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(ListQuery)
  .handler(async ({ data }) => foods(await getDb()).list(data.q));

export const createFood = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(FoodCreate)
  .handler(async ({ data }) => foods(await getDb()).create(data));

export const updateFood = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(FoodUpdate)
  .handler(async ({ data: { id, ...patch } }) => required(foods(await getDb()).update(id, patch), "food", id));

/**
 * This food's conversions, replaced wholesale (decisions.md row 69). `updateFood`
 * carries them too; this is the call the conversions editor makes on its own.
 */
export const setFoodConversions = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(FoodConversions)
  .handler(async ({ data: { id, conversions } }) => required(foods(await getDb()).setConversions(id, conversions), "food", id));

/** Deletes and returns the row, as Mealie does. */
export const deleteFood = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(async ({ data }) => {
    const repo = foods(await getDb());
    const food = required(repo.get(data.id), "food", data.id);
    repo.remove(data.id);
    return food;
  });

/** The existing food with this name (case-insensitive), else a new one. */
export const findOrCreateFood = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(NameInput)
  .handler(async ({ data }) => foods(await getDb()).findOrCreate(data.name));

/**
 * The food this recipe is (M32.3, decisions.md row 70): the existing food of
 * the recipe's name, or a new one, with `recipeId` pointing back at the
 * recipe. Idempotent — running it twice on the same recipe returns the same
 * food, which is what "create or link" means. Not-found when the recipe is
 * unknown.
 */
export const foodForRecipe = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(RecipeFoodInput)
  .handler(async ({ data }) => {
    const db = await getDb();
    const recipe = required(recipes(db).getById(data.recipeId), "recipe", data.recipeId);
    const repo = foods(db);
    const food = repo.findOrCreate(recipe.name);
    if (food.recipeId === recipe.id) return food;
    return required(repo.update(food.id, { recipeId: recipe.id }), "food", food.id);
  });

/** The recipes with an ingredient of this food, for the delete/merge confirm dialogs. */
export const usingFood = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(async ({ data }) => recipes(await getDb()).usingFood(data.id));

/**
 * Merge `sourceId` into `targetId`: every ingredient using the source is
 * repointed to the target, then the source is deleted, in one transaction.
 * Not-found when either id is unknown.
 */
export const mergeFood = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(FoodMerge)
  .handler(async ({ data: { sourceId, targetId } }) => {
    const repo = foods(await getDb());
    required(repo.get(sourceId), "food", sourceId);
    required(repo.get(targetId), "food", targetId);
    return required(repo.merge(sourceId, targetId), "food", targetId);
  });
