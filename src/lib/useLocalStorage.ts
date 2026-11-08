// One localStorage value as React state, shared by every component that
// reads the same key. A tick on a toggle here has to reach a grid there at
// once, so every hook registers a refresh in one module-level set and a write
// tells the set; a `storage` event from another tab does the same. The
// usehooks-ts shape, with a set in place of a custom event.

import { useCallback, useEffect, useState } from "react";
import { browserStorage, readItem, signal, writeItem } from "./storage";

const changed = signal();

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
    const unsubscribe = changed.subscribe(refresh);
    // Any key: a re-read of an unchanged one costs nothing, and it keeps the set one set.
    window.addEventListener("storage", refresh);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", refresh);
    };
  }, [read]);

  const update = useCallback(
    (next: T) => {
      const storage = browserStorage();
      if (storage) writeItem(storage, key, next);
      // Own state first, so a write with no storage still shows on the control that made it.
      setValue(next);
      changed.notify();
    },
    [key]
  );
  return [value, update];
}
