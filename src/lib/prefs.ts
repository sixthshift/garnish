import { useCallback, useEffect, useState } from "react";

/** The slice of `Storage` the controller uses. */
export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type ViewMode = "grid" | "list";
export type SortKey = "name" | "created" | "updated" | "lastMade" | "rating" | "random";
export type SortDir = "asc" | "desc";
export type Sort = { key: SortKey; dir: SortDir };
export type IngredientMode = "structured" | "summary";
export type Theme = "light" | "dark" | "system";

const KEY_VIEW_MODE = "garnish.viewMode";
const KEY_SORT = "garnish.sort";
const KEY_INGREDIENT_MODE = "garnish.ingredientMode";
const KEY_SCREEN_AWAKE = "garnish.screenAwake";
const KEY_THEME = "theme"; // the design system's own key and encoding, so its bootstrapTheme/useTheme read the same value

const VIEW_MODES: readonly ViewMode[] = ["grid", "list"];
const SORT_KEYS: readonly SortKey[] = ["name", "created", "updated", "lastMade", "rating", "random"];
const SORT_DIRS: readonly SortDir[] = ["asc", "desc"];
const INGREDIENT_MODES: readonly IngredientMode[] = ["structured", "summary"];
const THEMES: readonly Theme[] = ["light", "dark", "system"];

const DEFAULT_VIEW_MODE: ViewMode = "grid";
const DEFAULT_SORT: Sort = { key: "name", dir: "asc" };
const DEFAULT_INGREDIENT_MODE: IngredientMode = "structured";
const DEFAULT_THEME: Theme = "system";
const DEFAULT_SCREEN_AWAKE = true;

/** Type guard over a fixed set of allowed values. Pure. */
function oneOf<T>(values: readonly T[]): (value: unknown) => value is T {
  return (value): value is T => (values as readonly unknown[]).includes(value);
}

const isViewMode = oneOf(VIEW_MODES);
const isIngredientMode = oneOf(INGREDIENT_MODES);
const isTheme = oneOf(THEMES);

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isSort(value: unknown): value is Sort {
  if (typeof value !== "object" || value === null) return false;
  const { key, dir } = value as Record<string, unknown>;
  return oneOf(SORT_KEYS)(key) && oneOf(SORT_DIRS)(dir);
}

/**
 * Read and JSON-parse `key` from `storage`, falling back to `fallback`
 * whenever it is missing, malformed, holds something `isValid` rejects, or
 * the storage throws (disabled, or a security error in a locked-down frame).
 */
function readPref<T>(storage: StorageLike, key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  try {
    const raw = storage.getItem(key);
    if (raw == null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** JSON-encode and write `value` to `storage`. A throwing storage (full, disabled) just means the preference does not stick. */
function writePref(storage: StorageLike, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // ignored: see above
  }
}

export function getViewMode(storage: StorageLike): ViewMode {
  return readPref(storage, KEY_VIEW_MODE, DEFAULT_VIEW_MODE, isViewMode);
}
export function setViewMode(storage: StorageLike, mode: ViewMode): void {
  writePref(storage, KEY_VIEW_MODE, mode);
}

export function getSort(storage: StorageLike): Sort {
  return readPref(storage, KEY_SORT, DEFAULT_SORT, isSort);
}
export function setSort(storage: StorageLike, sort: Sort): void {
  writePref(storage, KEY_SORT, sort);
}

export function getIngredientMode(storage: StorageLike): IngredientMode {
  return readPref(storage, KEY_INGREDIENT_MODE, DEFAULT_INGREDIENT_MODE, isIngredientMode);
}
export function setIngredientMode(storage: StorageLike, mode: IngredientMode): void {
  writePref(storage, KEY_INGREDIENT_MODE, mode);
}

export function getTheme(storage: StorageLike): Theme {
  return readPref(storage, KEY_THEME, DEFAULT_THEME, isTheme);
}
export function setTheme(storage: StorageLike, theme: Theme): void {
  writePref(storage, KEY_THEME, theme);
}

export function getScreenAwake(storage: StorageLike): boolean {
  return readPref(storage, KEY_SCREEN_AWAKE, DEFAULT_SCREEN_AWAKE, isBoolean);
}
export function setScreenAwake(storage: StorageLike, awake: boolean): void {
  writePref(storage, KEY_SCREEN_AWAKE, awake);
}

/** `window.localStorage`, or undefined on the server and where it is unavailable. */
function browserStorage(): StorageLike | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

// --- The hooks ---------------------------------------------------------------
//
// A preference is one process-wide value, not a component's: the view toggle
// and the recipe grid both read it, and a press on one has to reach the other
// at once. So every hook keeps the value in `useState` for its own render,
// registers a refresh in one module-level set, and a write tells every
// registered hook to re-read; a `storage` event from another tab does the
// same. The usehooks-ts shape, with a set in place of a custom event.

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/** A `[value, setValue]` pair over one preference. Every reader re-renders on every write. */
function usePref<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): [T, (value: T) => void] {
  const read = useCallback((): T => {
    const storage = browserStorage();
    return storage ? readPref(storage, key, fallback, isValid) : fallback;
  }, [key, fallback, isValid]);
  const [value, setValue] = useState<T>(read);

  useEffect(() => {
    const refresh = () => setValue(read());
    listeners.add(refresh);
    // Any key: the theme lives under the design system's own key, and a re-read of an unchanged one costs nothing.
    window.addEventListener("storage", refresh);
    return () => {
      listeners.delete(refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [read]);

  const update = useCallback(
    (next: T) => {
      const storage = browserStorage();
      if (storage) writePref(storage, key, next);
      // Own state first, so a write with no storage still shows on the control that made it.
      setValue(next);
      notify();
    },
    [key]
  );
  return [value, update];
}

export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  return usePref(KEY_VIEW_MODE, DEFAULT_VIEW_MODE, isViewMode);
}

export function useSort(): [Sort, (sort: Sort) => void] {
  return usePref(KEY_SORT, DEFAULT_SORT, isSort);
}

export function useIngredientMode(): [IngredientMode, (mode: IngredientMode) => void] {
  return usePref(KEY_INGREDIENT_MODE, DEFAULT_INGREDIENT_MODE, isIngredientMode);
}

/** Mirrors the design system's `useTheme` for API consistency with the other preferences; see the header comment. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  return usePref(KEY_THEME, DEFAULT_THEME, isTheme);
}

export function useScreenAwake(): [boolean, (awake: boolean) => void] {
  return usePref(KEY_SCREEN_AWAKE, DEFAULT_SCREEN_AWAKE, isBoolean);
}
