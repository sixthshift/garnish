import { useCallback, useEffect, useState } from "react";
import { anyTicked, clearTicks, isIngredientTicked, isStepTicked, type StorageLike, subscribeTicks, toggleIngredientTicked, toggleStepTicked } from "./ticks";

/** `window.sessionStorage`, or undefined on the server and where it is unavailable. */
function browserStorage(): StorageLike | undefined {
  return typeof window === "undefined" ? undefined : window.sessionStorage;
}

/** Clear all ticks for `recipeId` in the browser's own storage, notifying every reader. No-op on the server. */
export function clearTicksNow(recipeId: string): void {
  const storage = browserStorage();
  if (storage) clearTicks(storage, recipeId);
}

type Read = (storage: StorageLike, recipeId: string, id: string) => boolean;
type Toggle = (storage: StorageLike, recipeId: string, id: string) => void;

/**
 * A `[done, toggle]` pair for one row, backed by sessionStorage. Reads on
 * mount, then re-reads on every tick write anywhere: the same ingredient can be
 * on the page and in the phone's ingredients sheet at once, and ticking either
 * has to strike both through.
 */
function useTick(read: Read, toggleIn: Toggle, recipeId: string, id: string): [boolean, () => void] {
  const snapshot = useCallback(() => {
    const storage = browserStorage();
    return storage ? read(storage, recipeId, id) : false;
  }, [read, recipeId, id]);
  const [done, setDone] = useState(snapshot);
  useEffect(() => subscribeTicks(() => setDone(snapshot())), [snapshot]);
  const toggle = useCallback(() => {
    // The write notifies this hook's own subscription, which sets the state.
    // Without a storage (the server, a locked-down browser) nothing is written
    // and nothing is notified, so the row keeps the flip locally.
    const storage = browserStorage();
    if (storage) toggleIn(storage, recipeId, id);
    else setDone((was) => !was);
  }, [toggleIn, recipeId, id]);
  return [done, toggle];
}

/** A `[done, toggle]` pair for one ingredient row. */
export function useIngredientTick(recipeId: string, ingredientId: string): [boolean, () => void] {
  return useTick(isIngredientTicked, toggleIngredientTicked, recipeId, ingredientId);
}

/** A `[done, toggle]` pair for one step. */
export function useStepTick(recipeId: string, stepId: string): [boolean, () => void] {
  return useTick(isStepTicked, toggleStepTicked, recipeId, stepId);
}

/**
 * Whether `recipeId` has anything ticked, following the same subscription as
 * the per-row hooks: a tick or a clear from anywhere re-reads it. Backs the
 * ingredients heading's "Clear" link, which only shows once there is
 * something to clear.
 */
export function useAnyTicked(recipeId: string): boolean {
  const snapshot = useCallback(() => {
    const storage = browserStorage();
    return storage ? anyTicked(storage, recipeId) : false;
  }, [recipeId]);
  const [any, setAny] = useState(snapshot);
  useEffect(() => subscribeTicks(() => setAny(snapshot())), [snapshot]);
  return any;
}
