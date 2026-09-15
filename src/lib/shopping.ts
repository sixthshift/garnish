// One "Add to shopping list" tap, end to end: read the list, plan the merge, write the plan through two server functions.

import {
  mergeIntoList,
  type ShoppingAddition,
  type ShoppingItem,
  type ShoppingItemInput,
  type ShoppingListMerge,
  type ShoppingMergePlan,
} from "../domain/shopping";
import { addShoppingItems, listShoppingItems, mergeShoppingItems } from "../server/fns/shopping";

/**
 * How many lines of the list the tap touched: the ones it created plus the ones
 * it topped up. Not the number of rows sent — two lots of flour are one line.
 * Pure.
 */
export function addedCount(plan: ShoppingMergePlan): number {
  return plan.merges.length + plan.additions.length;
}

/** "1 item added" / "3 items added". Pure. */
export function addedMessage(count: number): string {
  return `${count} item${count === 1 ? "" : "s"} added`;
}

/** The three calls the flow makes, injected so tests can watch them. */
export type ShoppingWriter = {
  list: () => Promise<ShoppingItem[]>;
  add: (items: ShoppingItemInput[]) => Promise<unknown>;
  merge: (merges: ShoppingListMerge[]) => Promise<unknown>;
};

/** The app's writer: the real server functions. */
export const serverShoppingWriter: ShoppingWriter = {
  list: () => listShoppingItems(),
  add: (items) => addShoppingItems({ data: { items } }),
  merge: (merges) => mergeShoppingItems({ data: { merges } }),
};

/**
 * Add `additions` to the one household list, merging into what is already
 * there. Resolves with the number of lines touched, for the toast. An empty
 * batch writes nothing.
 */
export async function addToShoppingList(additions: readonly ShoppingAddition[], writer: ShoppingWriter = serverShoppingWriter): Promise<number> {
  if (additions.length === 0) return 0;
  const plan = mergeIntoList(await writer.list(), additions);
  if (plan.additions.length > 0) await writer.add(plan.additions);
  if (plan.merges.length > 0) await writer.merge(plan.merges);
  return addedCount(plan);
}
