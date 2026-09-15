import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { shopping } from "../../db/models/shopping/repo";
import { Id, IdInput } from "../../domain/reference";
import { shoppingItemInputSchema, shoppingItemPatchSchema, shoppingItemSourceInputSchema } from "../../domain/shopping";
import { getDb } from "../core/db";
import { required } from "../core/errors";
import { notFoundMiddleware } from "../core/fn";

export const AddShoppingItemsInput = z.object({ items: z.array(shoppingItemInputSchema) });

/** One entry of `mergeIntoList`'s `merges`: a line's new total and the sources behind it. */
export const MergeShoppingItemsInput = z.object({
  merges: z.array(
    z.object({
      id: Id,
      quantity: z.number().nonnegative().nullable(),
      sources: z.array(shoppingItemSourceInputSchema).default([]),
    })
  ),
});

export const UpdateShoppingItemInput = shoppingItemPatchSchema.extend({ id: Id });

export const TickShoppingItemInput = z.object({ id: Id, ticked: z.boolean() });

export const ReorderShoppingItemsInput = z.object({ ids: z.array(Id) });

/** The whole list in position order; the page groups it by aisle. */
export const listShoppingItems = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .handler(async () => shopping(await getDb()).list());

/** Append lines to the end of the list with their sources. Returns the stored lines. */
export const addShoppingItems = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(AddShoppingItemsInput)
  .handler(async ({ data }) => shopping(await getDb()).addMany(data.items));

/**
 * Apply `mergeIntoList`'s `merges` half: each named line takes its new
 * total and keeps the sources appended to it. The `additions` half goes through
 * `addShoppingItems`; the two together are one "Add to shopping list" tap.
 * Not-found when any id is unknown.
 */
export const mergeShoppingItems = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(MergeShoppingItemsInput)
  .handler(async ({ data }) => {
    const repo = shopping(await getDb());
    return data.merges.map((merge) => required(repo.mergeInto(merge.id, merge.quantity, merge.sources), "shopping item", merge.id));
  });

/** Merge a patch into one line. Not-found when the id is unknown. */
export const updateShoppingItem = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(UpdateShoppingItemInput)
  .handler(async ({ data: { id, ...patch } }) => required(shopping(await getDb()).update(id, patch), "shopping item", id));

/** Tick or untick a line: the write the supermarket queues. */
export const tickShoppingItem = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(TickShoppingItemInput)
  .handler(async ({ data }) => required(shopping(await getDb()).tick(data.id, data.ticked), "shopping item", data.id));

/** Delete one line and its sources. Returns the id, as the timeline delete does. */
export const removeShoppingItem = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(async ({ data }) => {
    const repo = shopping(await getDb());
    required(repo.get(data.id), "shopping item", data.id);
    repo.remove(data.id);
    return { id: data.id };
  });

/** Delete every ticked line — "Clear ticked" at the foot of the list. */
export const clearTickedShoppingItems = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .handler(async () => ({ removed: shopping(await getDb()).clearTicked() }));

/** Write a new order from the full list of ids. Returns the list afterwards. */
export const reorderShoppingItems = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(ReorderShoppingItemsInput)
  .handler(async ({ data }) => shopping(await getDb()).reorder(data.ids));
