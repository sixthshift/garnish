/** The slice of `Storage` the controller uses. */
export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

/** Which ingredient and step ids (recipe-scoped, see src/domain/recipe/recipe.ts) are ticked for one recipe. */
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
 * and in the phone's ingredients sheet at the same time, so a write
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
