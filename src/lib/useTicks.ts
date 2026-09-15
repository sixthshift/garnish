import { useCallback, useEffect, useState } from "react";
import { anyTicked, clearTicks, isIngredientTicked, isStepTicked, type StorageLike, subscribeTicks, toggleIngredientTicked, toggleStepTicked } from "./ticks";

/** `window.sessionStorage`, or undefined on the server and where it is unavailable. */
function browserStorage(): StorageLike | undefined {
  return typeof window === "undefined" ? undefined : window.sessionStorage;
}

/** Whether `ingredientId` is ticked in the browser's own storage. False on the server. */
export function ingredientTickSnapshot(recipeId: string, ingredientId: string): boolean {
  const storage = browserStorage();
  return storage ? isIngredientTicked(storage, recipeId, ingredientId) : false;
}

/** Flip `ingredientId`'s tick in the browser's own storage, notifying every reader. No-op on the server. */
export function toggleIngredientTickNow(recipeId: string, ingredientId: string): void {
  const storage = browserStorage();
  if (storage) toggleIngredientTicked(storage, recipeId, ingredientId);
}

/** Whether `stepId` is ticked in the browser's own storage. False on the server. */
export function stepTickSnapshot(recipeId: string, stepId: string): boolean {
  const storage = browserStorage();
  return storage ? isStepTicked(storage, recipeId, stepId) : false;
}

/** Flip `stepId`'s tick in the browser's own storage, notifying every reader. No-op on the server. */
export function toggleStepTickNow(recipeId: string, stepId: string): void {
  const storage = browserStorage();
  if (storage) toggleStepTicked(storage, recipeId, stepId);
}

/** Clear all ticks for `recipeId` in the browser's own storage, notifying every reader. No-op on the server. */
export function clearTicksNow(recipeId: string): void {
  const storage = browserStorage();
  if (storage) clearTicks(storage, recipeId);
}

/** Whether anything is ticked for `recipeId` in the browser's own storage. False on the server. */
export function anyTickedSnapshot(recipeId: string): boolean {
  const storage = browserStorage();
  return storage ? anyTicked(storage, recipeId) : false;
}

/**
 * A `[done, toggle]` pair for one ingredient row, backed by sessionStorage.
 * Reads on mount, then re-reads on every tick write anywhere: the same
 * ingredient can be on the page and in the phone's ingredients sheet at once
 *, and ticking either has to strike both through.
 */
export function useIngredientTick(recipeId: string, ingredientId: string): [boolean, () => void] {
  const [done, setDone] = useState(() => ingredientTickSnapshot(recipeId, ingredientId));
  useEffect(() => subscribeTicks(() => setDone(ingredientTickSnapshot(recipeId, ingredientId))), [recipeId, ingredientId]);
  const toggle = useCallback(() => {
    // The write notifies this hook's own subscription, which sets the state.
    // Without a storage (the server, a locked-down browser) nothing is written
    // and nothing is notified, so the row keeps the flip locally.
    const storage = browserStorage();
    if (storage) toggleIngredientTicked(storage, recipeId, ingredientId);
    else setDone((was) => !was);
  }, [recipeId, ingredientId]);
  return [done, toggle];
}

/** A `[done, toggle]` pair for one step, backed by sessionStorage. Same shape as `useIngredientTick`. */
export function useStepTick(recipeId: string, stepId: string): [boolean, () => void] {
  const [done, setDone] = useState(() => stepTickSnapshot(recipeId, stepId));
  useEffect(() => subscribeTicks(() => setDone(stepTickSnapshot(recipeId, stepId))), [recipeId, stepId]);
  const toggle = useCallback(() => {
    const storage = browserStorage();
    if (storage) toggleStepTicked(storage, recipeId, stepId);
    else setDone((was) => !was);
  }, [recipeId, stepId]);
  return [done, toggle];
}

/**
 * Whether `recipeId` has anything ticked, following the same subscription as
 * the per-row hooks: a tick or a clear from anywhere re-reads it. Backs the
 * ingredients heading's "Clear" link, which only shows once there is
 * something to clear.
 */
export function useAnyTicked(recipeId: string): boolean {
  const [any, setAny] = useState(() => anyTickedSnapshot(recipeId));
  useEffect(() => subscribeTicks(() => setAny(anyTickedSnapshot(recipeId))), [recipeId]);
  return any;
}
