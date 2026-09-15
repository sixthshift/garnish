/**
 * An object built on first touch and kept for as long as its key lasts. Each
 * property read calls `key()`, builds the value for that key once (a WeakMap
 * holds it), and forwards to it; a new key means a new build. For a factory
 * over a cached resource — a repository over the process database — this makes
 * `import repo from "./repo"; repo.get(id)` work without the module opening
 * anything at import time, with one repository per connection for the life of
 * the process, and without holding a value that outlives the connection it was
 * built on (a test closes the database and opens another between cases).
 */
export function lazy<K extends object, T extends object>(key: () => K, build: (key: K) => T): T {
  const built = new WeakMap<K, T>();
  const current = (): T => {
    const k = key();
    const existing = built.get(k);
    if (existing) return existing;
    const created = build(k);
    built.set(k, created);
    return created;
  };
  return new Proxy({} as T, {
    get(_, prop) {
      return Reflect.get(current(), prop);
    },
    has(_, prop) {
      return Reflect.has(current(), prop);
    },
    ownKeys() {
      return Reflect.ownKeys(current());
    },
    getOwnPropertyDescriptor(_, prop) {
      const descriptor = Reflect.getOwnPropertyDescriptor(current(), prop);
      return descriptor && { ...descriptor, configurable: true };
    },
  });
}
