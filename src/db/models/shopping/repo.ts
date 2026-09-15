import type { Database } from "bun:sqlite";
import { lazy } from "../../../lib/lazy";
import { getDb } from "../../../server/core/db";
import { shoppingContext } from "./context";
import { readers } from "./read";
import { writers } from "./write";

export function shopping(db: Database) {
  const ctx = shoppingContext(db);
  const { get, list } = readers(ctx);
  const { addMany, mergeInto, update, tick, remove, clearTicked, reorder } = writers(ctx, { get, list });

  return { list, get, addMany, mergeInto, update, tick, remove, clearTicked, reorder };
}

export type ShoppingRepository = ReturnType<typeof shopping>;

/** The repository over the application database. Tests build their own with `shopping(db)`. */
export default lazy(getDb, shopping);
