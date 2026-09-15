import type { Database } from "bun:sqlite";
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
