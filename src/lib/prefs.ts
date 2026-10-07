// The device's preferences: one table of what is kept, and a hook per entry
// over useLocalStorage. A preference is what this phone was doing (view mode,
// theme), not household data: it survives a reload and never reaches the
// server or another device.

import { readItem, type StorageLike, useLocalStorage, writeItem } from "./useLocalStorage";

export type ViewMode = "grid" | "list";
export type IngredientMode = "structured" | "summary";
export type Theme = "light" | "dark" | "system";

/** One preference: where it lives, what it is when unset, and what counts as one. */
export type Pref<T> = {
  key: string;
  fallback: T;
  isValid: (value: unknown) => value is T;
};

/** A preference that is one of a fixed set of values. */
function oneOf<T>(key: string, fallback: T, values: readonly T[]): Pref<T> {
  return { key, fallback, isValid: (value): value is T => (values as readonly unknown[]).includes(value) };
}

/**
 * Every preference this device keeps. Keys are under `garnish.` except the
 * theme, which shares the design system's own key and encoding so its
 * `bootstrapTheme` paints the same value before React runs.
 */
export const prefs = {
  /** The home page's recipe grid or list. Unset, a phone reads list instead: see `useViewMode`. */
  viewMode: oneOf<ViewMode>("garnish.viewMode", "grid", ["grid", "list"]),
  /** The recipe page's ingredients as rows per part, or one list. */
  ingredientMode: oneOf<IngredientMode>("garnish.ingredientMode", "structured", ["structured", "summary"]),
  theme: oneOf<Theme>("theme", "system", ["light", "dark", "system"]),
} as const;

/** `pref`'s value in `storage`, or its fallback. Pure. */
export function readPref<T>(storage: StorageLike, pref: Pref<T>): T {
  return readItem(storage, pref.key, pref.fallback, pref.isValid);
}

/** Write `value` under `pref`'s key. */
export function writePref<T>(storage: StorageLike, pref: Pref<T>, value: T): void {
  writeItem(storage, pref.key, value);
}

/** A `[value, setValue]` pair over one preference, shared by every reader of it. */
export function usePref<T>(pref: Pref<T>): [T, (value: T) => void] {
  return useLocalStorage(pref.key, pref.fallback, pref.isValid);
}

/** Tailwind's `md:`, the width the home page's grid starts at when no one has chosen a view. */
export const VIEW_MODE_GRID_QUERY = "(min-width: 48rem)";

/**
 * The view the home page shows while nothing is stored: a list on a phone,
 * where the grid's tall cards fit two to a screen and the index is for
 * scanning, and the table's grid from `md:` up. With no screen to ask (the
 * server, a test without a window) it is the table's fallback. Read when the
 * hook first renders, so the first paint is already right; a choice, once
 * stored, wins at every width.
 */
export function defaultViewMode(): ViewMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return prefs.viewMode.fallback;
  return window.matchMedia(VIEW_MODE_GRID_QUERY).matches ? "grid" : "list";
}

export const useViewMode = () => usePref({ ...prefs.viewMode, fallback: defaultViewMode() });
export const useIngredientMode = () => usePref(prefs.ingredientMode);
export const useTheme = () => usePref(prefs.theme);
