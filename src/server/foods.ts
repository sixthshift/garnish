// Food server functions. Every id lookup that misses raises NotFound.
import { createServerFn } from "@tanstack/react-start";
import { required } from "./errors";
import { foods } from "../db/models/food/repo";
import { recipes } from "../db/models/recipe/repo";
import { FoodConversions, FoodCreate, FoodMerge, FoodUpdate, IdInput, ListQuery, NameInput } from "../domain/reference";
import { getDb } from "./db";
import { notFoundMiddleware } from "./fn";

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
