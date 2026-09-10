// Ingredient and step "done" state for the recipe view and cook mode: which
// rows a cook has ticked off. Kept in `sessionStorage`, keyed by recipe id, so
// it resets when the browser session ends but is shared between a recipe's
// view page and its cook mode within one (both read and write the same key).
//
// Same shape as prefs.ts: a pure controller over a storage-like interface,
// try/catch around every access, and thin hooks that read once on mount and
// write through on every change.
import { useCallback, useState } from "react";

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

/** Write `state` for `recipeId`. A throwing storage (full, disabled) just means ticks do not persist this session. */
function putTicks(storage: StorageLike, recipeId: string, state: TicksState): void {
  try {
    storage.setItem(storageKey(recipeId), JSON.stringify(state));
  } catch {
    // ignored: see above
  }
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

/** Clear all ticks for `recipeId`, e.g. on finishing a cook. */
export function clearTicks(storage: StorageLike, recipeId: string): void {
  putTicks(storage, recipeId, EMPTY);
}

/** `window.sessionStorage`, or undefined on the server and where it is unavailable. */
function browserStorage(): StorageLike | undefined {
  return typeof window === "undefined" ? undefined : window.sessionStorage;
}

/** A `[done, toggle]` pair for one ingredient row, backed by sessionStorage. Reads once on mount (keyed to `recipeId`/`ingredientId`); `toggle` writes through. */
export function useIngredientTick(recipeId: string, ingredientId: string): [boolean, () => void] {
  const [done, setDone] = useState(() => {
    const storage = browserStorage();
    return storage ? isIngredientTicked(storage, recipeId, ingredientId) : false;
  });
  const toggle = useCallback(() => {
    setDone((was) => {
      const next = !was;
      const storage = browserStorage();
      if (storage) setIngredientTicked(storage, recipeId, ingredientId, next);
      return next;
    });
  }, [recipeId, ingredientId]);
  return [done, toggle];
}

/** A `[done, toggle]` pair for one step, backed by sessionStorage. Same shape as `useIngredientTick`. */
export function useStepTick(recipeId: string, stepId: string): [boolean, () => void] {
  const [done, setDone] = useState(() => {
    const storage = browserStorage();
    return storage ? isStepTicked(storage, recipeId, stepId) : false;
  });
  const toggle = useCallback(() => {
    setDone((was) => {
      const next = !was;
      const storage = browserStorage();
      if (storage) setStepTicked(storage, recipeId, stepId, next);
      return next;
    });
  }, [recipeId, stepId]);
  return [done, toggle];
}
