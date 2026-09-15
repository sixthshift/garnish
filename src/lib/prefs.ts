// Client display preferences: view mode, sort, ingredient display mode,
// theme and the screen-awake switch. All in `localStorage`.
//
// Same shape as useWakeLock.ts / useOnline.ts: a pure controller over a
// storage-like interface (so it can be unit tested without a DOM, including a
// storage that throws) and thin hooks around it. Unlike those two, there is no
// external event to listen for here — a preference only changes when this tab
// calls the setter — so the hooks are plain read-on-mount, write-through state.
//
// `theme`'s key ("theme") and JSON encoding deliberately match the design
// system's own store (`@sixthshift/design-system/hooks`, `bootstrapTheme` /
// `useTheme`), which already owns applying the value to the DOM and reacting
// to OS and cross-tab changes. The functions here exist so callers that don't
// need that machinery (or aren't React) can still read and write the same
// setting; `useTheme` below is a plain mirror for consistency with the other
// preferences and does not replace the design system's hook.
import { useCallback, useState } from "react";

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
const KEY_THEME = "theme"; // shared with the design system, see header comment

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
  return readPref(storage, KEY_VIEW_MODE, DEFAULT_VIEW_MODE, oneOf(VIEW_MODES));
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
  return readPref(storage, KEY_INGREDIENT_MODE, DEFAULT_INGREDIENT_MODE, oneOf(INGREDIENT_MODES));
}
export function setIngredientMode(storage: StorageLike, mode: IngredientMode): void {
  writePref(storage, KEY_INGREDIENT_MODE, mode);
}

export function getTheme(storage: StorageLike): Theme {
  return readPref(storage, KEY_THEME, DEFAULT_THEME, oneOf(THEMES));
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

/** A `[value, setValue]` pair backed by one localStorage-shaped preference. Reads once on mount; writes through on every set. */
function usePref<T>(get: (storage: StorageLike) => T, set: (storage: StorageLike, value: T) => void, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const storage = browserStorage();
    return storage ? get(storage) : fallback;
  });
  const update = useCallback(
    (next: T) => {
      const storage = browserStorage();
      if (storage) set(storage, next);
      setValue(next);
    },
    [set]
  );
  return [value, update];
}

export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  return usePref(getViewMode, setViewMode, DEFAULT_VIEW_MODE);
}

export function useSort(): [Sort, (sort: Sort) => void] {
  return usePref(getSort, setSort, DEFAULT_SORT);
}

export function useIngredientMode(): [IngredientMode, (mode: IngredientMode) => void] {
  return usePref(getIngredientMode, setIngredientMode, DEFAULT_INGREDIENT_MODE);
}

/** Mirrors the design system's `useTheme` for API consistency with the other preferences; see the header comment. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  return usePref(getTheme, setTheme, DEFAULT_THEME);
}

export function useScreenAwake(): [boolean, (awake: boolean) => void] {
  return usePref(getScreenAwake, setScreenAwake, DEFAULT_SCREEN_AWAKE);
}
