// Ingredient and step "done" state for the recipe view and cook mode: which
// rows a cook has ticked off. Kept in `sessionStorage`, keyed by recipe id, so
// it resets when the browser session ends but is shared between a recipe's
// view page and its cook mode within one (both read and write the same key).
//
// Same shape as prefs.ts: a pure controller over a storage-like interface,
// try/catch around every access, and thin hooks over it. The hooks read on
// mount and then follow the store: a write notifies every subscriber, so two
// rows for the same ingredient — the page's and the phone sheet's (M24.6) —
// stay in step.
import { useCallback, useEffect, useState } from "react";

/** The slice of `Storage` the controller uses. */
export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

/** Which ingredient and step ids (recipe-scoped, see src/domain/recipe.ts) are ticked for one recipe. */
export type TicksState = { ingredients: string[]; steps: string[] };

const EMPTY: TicksState = { ingredients: [], steps: [] };

function storageKey(recipeId: string): string {
  return `garnish.ticks.${recipeId}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isTicksState(value: unknown): value is TicksState {
  if (typeof value !== "object" || value === null) return false;
  const { ingredients, steps } = value as Record<string, unknown>;
  return isStringArray(ingredients) && isStringArray(steps);
}

/** The ticked ingredient and step ids for `recipeId`. Empty when unset, malformed, or the storage throws. */
export function getTicks(storage: StorageLike, recipeId: string): TicksState {
  try {
    const raw = storage.getItem(storageKey(recipeId));
    if (raw == null) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    return isTicksState(parsed) ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

/**
 * Everything currently reading tick state. A recipe's rows can be on the page
 * and in the phone's ingredients sheet at the same time (M24.6), so a write
 * from either has to reach both: `putTicks` tells every listener, and the
 * hooks below re-read through `useSyncExternalStore`. Module-level rather than
 * a context because ticks are one process-wide store, not a tree's state.
 */
const listeners = new Set<() => void>();

/** Listen for any tick write. Returns the unsubscribe. */
export function subscribeTicks(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Write `state` for `recipeId`. A throwing storage (full, disabled) just means ticks do not persist this session. */
function putTicks(storage: StorageLike, recipeId: string, state: TicksState): void {
  try {
    storage.setItem(storageKey(recipeId), JSON.stringify(state));
  } catch {
    // ignored: see above
  }
  for (const listener of [...listeners]) listener();
}

/** `list` with `id` present or absent according to `done`, de-duplicated. Pure. */
function withMark(list: string[], id: string, done: boolean): string[] {
  const set = new Set(list);
  if (done) set.add(id);
  else set.delete(id);
  return [...set];
}

export function isIngredientTicked(storage: StorageLike, recipeId: string, ingredientId: string): boolean {
  return getTicks(storage, recipeId).ingredients.includes(ingredientId);
}

export function isStepTicked(storage: StorageLike, recipeId: string, stepId: string): boolean {
  return getTicks(storage, recipeId).steps.includes(stepId);
}

export function setIngredientTicked(storage: StorageLike, recipeId: string, ingredientId: string, done: boolean): TicksState {
  const current = getTicks(storage, recipeId);
  const next: TicksState = { ...current, ingredients: withMark(current.ingredients, ingredientId, done) };
  putTicks(storage, recipeId, next);
  return next;
}

export function setStepTicked(storage: StorageLike, recipeId: string, stepId: string, done: boolean): TicksState {
  const current = getTicks(storage, recipeId);
  const next: TicksState = { ...current, steps: withMark(current.steps, stepId, done) };
  putTicks(storage, recipeId, next);
  return next;
}

export function toggleIngredientTicked(storage: StorageLike, recipeId: string, ingredientId: string): TicksState {
  return setIngredientTicked(storage, recipeId, ingredientId, !isIngredientTicked(storage, recipeId, ingredientId));
}

export function toggleStepTicked(storage: StorageLike, recipeId: string, stepId: string): TicksState {
  return setStepTicked(storage, recipeId, stepId, !isStepTicked(storage, recipeId, stepId));
}

/** Clear all ticks for `recipeId`, e.g. on finishing a cook. Notifies subscribers, same as any other write. */
export function clearTicks(storage: StorageLike, recipeId: string): void {
  putTicks(storage, recipeId, EMPTY);
}

/** Whether anything — any ingredient or step — is ticked for `recipeId`. */
export function anyTicked(storage: StorageLike, recipeId: string): boolean {
  const ticks = getTicks(storage, recipeId);
  return ticks.ingredients.length > 0 || ticks.steps.length > 0;
}

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
 * (M24.6), and ticking either has to strike both through.
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
 * ingredients heading's "Clear" link (M25.6), which only shows once there is
 * something to clear.
 */
export function useAnyTicked(recipeId: string): boolean {
  const [any, setAny] = useState(() => anyTickedSnapshot(recipeId));
  useEffect(() => subscribeTicks(() => setAny(anyTickedSnapshot(recipeId))), [recipeId]);
  return any;
}
