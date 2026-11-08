// An in-memory web storage for tests: what `window.localStorage` or
// `sessionStorage` is to a store, backed by a Map the test can look into.
import type { RemovableStorage } from "../../src/lib/storage";

export type MemoryStorage = RemovableStorage & { map: Map<string, string>; size: () => number };

/** A fresh storage, holding `seed`'s keys to start with. */
export function memoryStorage(seed: Record<string, string> = {}): MemoryStorage {
  const map = new Map(Object.entries(seed));
  return {
    map,
    size: () => map.size,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}
