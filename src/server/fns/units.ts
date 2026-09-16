import { createServerFn } from "@tanstack/react-start";
import recipes from "../../db/models/recipe/repo";
import units from "../../db/models/unit/repo";
import { IdInput, ListQuery, NameInput, UnitCreate, UnitMerge, UnitUpdate } from "../../domain/reference";
import { required } from "../core/errors";
import { notFoundMiddleware } from "../core/fn";

export const listUnits = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(ListQuery)
  .handler(async ({ data }) => units.list(data.q));

export const createUnit = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(UnitCreate)
  .handler(async ({ data }) => units.create(data));

export const updateUnit = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(UnitUpdate)
  .handler(async ({ data: { id, ...patch } }) => required(units.update(id, patch), "unit", id));

/** Deletes and returns the row, as Mealie does. */
export const deleteUnit = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(async ({ data }) => {
    const unit = required(units.get(data.id), "unit", data.id);
    units.remove(data.id);
    return unit;
  });

/** The existing unit with this name (case-insensitive), else a new one. */
export const findOrCreateUnit = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(NameInput)
  .handler(async ({ data }) => units.findOrCreate(data.name));

/** The recipes with an ingredient or a yield unit of this unit, for the delete/merge confirm dialogs. */
export const usingUnit = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(async ({ data }) => recipes.query({ by: "unit", id: data.id }));

/**
 * Merge `sourceId` into `targetId`: every ingredient and recipe yield using
 * the source is repointed to the target, then the source is deleted, in one
 * transaction. Not-found when either id is unknown.
 */
export const mergeUnit = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(UnitMerge)
  .handler(async ({ data: { sourceId, targetId } }) => {
    required(units.get(sourceId), "unit", sourceId);
    required(units.get(targetId), "unit", targetId);
    return required(units.merge(sourceId, targetId), "unit", targetId);
  });
