// Shopping list server functions: the one household list (decisions.md row 67).
// Each is the full `createServerFn` chain (see ./fn.ts for why), reads through
// getDb() and hands back `ShoppingItem` documents from src/domain/shopping.ts.
//
// There is no list id in any signature because there is no second list.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { required } from "./errors";
import { shopping } from "../db/models/shopping/repo";
import { Id, IdInput } from "../domain/reference";
import { shoppingItemInputSchema, shoppingItemPatchSchema } from "../domain/shopping";
import { getDb } from "./db";
import { notFoundMiddleware } from "./fn";

export const AddShoppingItemsInput = z.object({ items: z.array(shoppingItemInputSchema) });

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

/** Merge a patch into one line. Not-found when the id is unknown. */
export const updateShoppingItem = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(UpdateShoppingItemInput)
  .handler(async ({ data: { id, ...patch } }) =>
    required(shopping(await getDb()).update(id, patch), "shopping item", id),
  );

/** Tick or untick a line: the write the supermarket queues (M31.5). */
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
