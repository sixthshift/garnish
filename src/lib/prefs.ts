// The device's preferences: one table of what is kept, the read and write
// over it, and one hook. A preference is what this phone was doing (view
// mode, theme), not household data: it lives in localStorage, survives a
// reload, and never reaches the server or another device.

import { useCallback, useEffect, useState } from "react";

/** The slice of `Storage` the reads and writes use. */
export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

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

// --- The table ---------------------------------------------------------------

/**
 * Every preference this device keeps. Keys are under `garnish.` except the
 * theme, which shares the design system's own key and encoding so its
 * `bootstrapTheme` paints the same value before React runs.
 */
export const prefs = {
  /** The home page's recipe grid or list. */
  viewMode: oneOf<ViewMode>("garnish.viewMode", "grid", ["grid", "list"]),
  /** The recipe page's ingredients as rows per part, or one list. */
  ingredientMode: oneOf<IngredientMode>("garnish.ingredientMode", "structured", ["structured", "summary"]),
  theme: oneOf<Theme>("theme", "system", ["light", "dark", "system"]),
} as const;

// --- Read and write ----------------------------------------------------------

/**
 * `pref`'s value in `storage`, or its fallback whenever it is missing,
 * malformed, holds something `isValid` rejects, or the storage throws
 * (disabled, or a security error in a locked-down frame). Pure.
 */
export function readPref<T>(storage: StorageLike, pref: Pref<T>): T {
  try {
    const raw = storage.getItem(pref.key);
    if (raw == null) return pref.fallback;
    const parsed: unknown = JSON.parse(raw);
    return pref.isValid(parsed) ? parsed : pref.fallback;
  } catch {
    return pref.fallback;
  }
}

/** JSON-encode and write `value` under `pref`'s key. A throwing storage (full, disabled) just means the preference does not stick. */
export function writePref<T>(storage: StorageLike, pref: Pref<T>, value: T): void {
  try {
    storage.setItem(pref.key, JSON.stringify(value));
  } catch {
    // ignored: see above
  }
}

// --- The hook ----------------------------------------------------------------
//
// A preference is one process-wide value, not a component's: the view toggle
// and the recipe grid both read it, and a press on one has to reach the other
// at once. So every hook keeps the value in `useState` for its own render,
// registers a refresh in one module-level set, and a write tells every
// registered hook to re-read; a `storage` event from another tab does the
// same. The usehooks-ts shape, with a set in place of a custom event.

/** `window.localStorage`, or undefined on the server and where it is unavailable. */
function browserStorage(): StorageLike | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

const listeners = new Set<() => void>();

/** A `[value, setValue]` pair over one preference. Every reader re-renders on every write. */
export function usePref<T>(pref: Pref<T>): [T, (value: T) => void] {
  const read = useCallback((): T => {
    const storage = browserStorage();
    return storage ? readPref(storage, pref) : pref.fallback;
  }, [pref]);
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
      if (storage) writePref(storage, pref, next);
      // Own state first, so a write with no storage still shows on the control that made it.
      setValue(next);
      for (const listener of [...listeners]) listener();
    },
    [pref]
  );
  return [value, update];
}

export const useViewMode = () => usePref(prefs.viewMode);
export const useIngredientMode = () => usePref(prefs.ingredientMode);
export const useTheme = () => usePref(prefs.theme);
