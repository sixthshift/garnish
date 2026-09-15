// Aisle server functions. Every id lookup that misses raises NotFound.
import { createServerFn } from "@tanstack/react-start";
import { aisles } from "../../db/models/aisle/repo";
import { AisleCreate, AisleReorder, AisleUpdate, IdInput, ListQuery, NameInput } from "../../domain/reference";
import { getDb } from "../core/db";
import { required } from "../core/errors";
import { notFoundMiddleware } from "../core/fn";

export const listAisles = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(ListQuery)
  .handler(async ({ data }) => aisles(await getDb()).list(data.q));

export const createAisle = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(AisleCreate)
  .handler(async ({ data }) => aisles(await getDb()).create(data));

export const updateAisle = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(AisleUpdate)
  .handler(async ({ data: { id, ...patch } }) => required(aisles(await getDb()).update(id, patch), "aisle", id));

/** Deletes and returns the row, as Mealie does. */
export const deleteAisle = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(async ({ data }) => {
    const repo = aisles(await getDb());
    const aisle = required(repo.get(data.id), "aisle", data.id);
    repo.remove(data.id);
    return aisle;
  });

/** The existing aisle with this name (case-insensitive), else a new one at the end. */
export const findOrCreateAisle = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(NameInput)
  .handler(async ({ data }) => aisles(await getDb()).findOrCreate(data.name));

/** Set every aisle's position from its index in `ids` (the drag list's full order); returns the list in the new order. */
export const reorderAisles = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(AisleReorder)
  .handler(async ({ data }) => aisles(await getDb()).reorder(data.ids));
