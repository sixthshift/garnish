// One localStorage value as React state, shared by every component that
// reads the same key. A tick on a toggle here has to reach a grid there at
// once, so every hook registers a refresh in one module-level set and a write
// tells the set; a `storage` event from another tab does the same. The
// usehooks-ts shape, with a set in place of a custom event.

import { useCallback, useEffect, useState } from "react";

/** The slice of `Storage` the reads and writes use. */
export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

/** `window.localStorage`, or undefined on the server and where it is unavailable. */
export function browserStorage(): StorageLike | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

/**
 * `key`'s value in `storage`, JSON-decoded, or `fallback` whenever it is
 * missing, malformed, holds something `isValid` rejects, or the storage
 * throws (disabled, or a security error in a locked-down frame). Pure.
 */
export function readItem<T>(storage: StorageLike, key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  try {
    const raw = storage.getItem(key);
    if (raw == null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** JSON-encode and write `value` under `key`. A throwing storage (full, disabled) just means the value does not stick. */
export function writeItem<T>(storage: StorageLike, key: string, value: T): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // ignored: see above
  }
}

const listeners = new Set<() => void>();

/**
 * A `[value, setValue]` pair over one localStorage key. Every reader of the
 * key re-renders on every write, from this tab or another. `isValid` guards
 * what an older build or another site may have left under the key; keep it
 * a stable function (module level), since a new one each render re-subscribes.
 */
export function useLocalStorage<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): [T, (value: T) => void] {
  const read = useCallback((): T => {
    const storage = browserStorage();
    return storage ? readItem(storage, key, fallback, isValid) : fallback;
  }, [key, fallback, isValid]);
  const [value, setValue] = useState<T>(read);

  useEffect(() => {
    const refresh = () => setValue(read());
    listeners.add(refresh);
    // Any key: a re-read of an unchanged one costs nothing, and it keeps the set one set.
    window.addEventListener("storage", refresh);
    return () => {
      listeners.delete(refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [read]);

  const update = useCallback(
    (next: T) => {
      const storage = browserStorage();
      if (storage) writeItem(storage, key, next);
      // Own state first, so a write with no storage still shows on the control that made it.
      setValue(next);
      for (const listener of [...listeners]) listener();
    },
    [key]
  );
  return [value, update];
}
