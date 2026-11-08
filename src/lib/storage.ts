// Web storage plumbing every store shares: the slice of `Storage` a store
// needs (so a test hands in a Map-backed fake), the browser's own when there
// is one, guarded JSON reads and writes, and the listener set that tells every
// reader of a store that it changed.

/** What a store reads and writes through: `window.localStorage`, `sessionStorage`, or a test's fake. */
export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

/** A store that also forgets keys. */
export type RemovableStorage = StorageLike & { removeItem: (key: string) => void };

/** The browser's local or session storage, or undefined on the server. */
export function browserStorage(kind: "local" | "session" = "local"): RemovableStorage | undefined {
  if (typeof window === "undefined") return undefined;
  return kind === "local" ? window.localStorage : window.sessionStorage;
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

/**
 * A set of listeners: `subscribe` returns the unsubscribe, `notify` calls
 * every one. Module-level stores (ticks, timers, preferences) are one per
 * process, not a tree's state, so a write from one screen reaches another.
 */
export function signal(): { subscribe: (listener: () => void) => () => void; notify: () => void } {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notify() {
      for (const listener of [...listeners]) listener();
    },
  };
}
