import { createServerFn } from "@tanstack/react-start";
import aisles from "../../db/models/aisle/repo";
import { AisleCreate, AisleReorder, AisleUpdate, IdInput, ListQuery, NameInput } from "../../domain/reference";
import { required } from "../core/errors";
import { notFoundMiddleware } from "../core/fn";

export const listAisles = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(ListQuery)
  .handler(async ({ data }) => aisles.list(data.q));

export const createAisle = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(AisleCreate)
  .handler(async ({ data }) => aisles.create(data));

export const updateAisle = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(AisleUpdate)
  .handler(async ({ data: { id, ...patch } }) => required(aisles.update(id, patch), "aisle", id));

/** Deletes and returns the row, as Mealie does. */
export const deleteAisle = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(async ({ data }) => {
    const aisle = required(aisles.get(data.id), "aisle", data.id);
    aisles.remove(data.id);
    return aisle;
  });

/** The existing aisle with this name (case-insensitive), else a new one at the end. */
export const findOrCreateAisle = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(NameInput)
  .handler(async ({ data }) => aisles.findOrCreate(data.name));

/** Set every aisle's position from its index in `ids` (the drag list's full order); returns the list in the new order. */
export const reorderAisles = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(AisleReorder)
  .handler(async ({ data }) => aisles.reorder(data.ids));
