// Unit server functions. Every id lookup that misses raises NotFound.
import { createServerFn } from "@tanstack/react-start";
import { required } from "../db/errors";
import { units } from "../db/units";
import { IdInput, ListQuery, NameInput, UnitCreate, UnitUpdate } from "../domain/reference";
import { getDb } from "./db";
import { notFoundMiddleware } from "./fn";

export const listUnits = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(ListQuery)
  .handler(async ({ data }) => units(await getDb()).list(data.q));

export const createUnit = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(UnitCreate)
  .handler(async ({ data }) => units(await getDb()).create(data));

export const updateUnit = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(UnitUpdate)
  .handler(async ({ data: { id, ...patch } }) => required(units(await getDb()).update(id, patch), "unit", id));

/** Deletes and returns the row, as Mealie does. */
export const deleteUnit = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(async ({ data }) => {
    const repo = units(await getDb());
    const unit = required(repo.get(data.id), "unit", data.id);
    repo.remove(data.id);
    return unit;
  });

/** The existing unit with this name (case-insensitive), else a new one. */
export const findOrCreateUnit = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(NameInput)
  .handler(async ({ data }) => units(await getDb()).findOrCreate(data.name));
