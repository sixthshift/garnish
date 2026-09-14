// Generic list operations: reorder, and every item but one.

/** Every item but the source. Pure. */
export function mergeTargets<T extends { id: string }>(items: readonly T[], sourceId: string): T[] {
  return items.filter((item) => item.id !== sourceId);
}

/**
 * A new array with the item at `from` moved to `to`. Out-of-range indices, or
 * `from === to`, return a copy in the original order. Pure.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = items.slice();
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}

/** A short, deterministic hash of `value` (32-bit FNV-1a). Pure. */
export function hash32(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * `rows` in a stable pseudo-random order: the same `seed` always reproduces
 * the same order (so filtering, favouriting or reloading the page doesn't
 * reshuffle it — and a future real pagination stays coherent across pages),
 * while a different seed gives a different order. Pure.
 */
export function seededOrder<T extends { id: string }>(rows: readonly T[], seed: string): T[] {
  return [...rows].sort((a, b) => hash32(`${seed}:${a.id}`) - hash32(`${seed}:${b.id}`));
}

/** A fresh seed for a new shuffle: chosen whenever "Random" is picked again. */
export function newSeed(): string {
  return crypto.randomUUID();
}

/** One item of `items` chosen uniformly at random, or `undefined` when empty. `random` defaults to `Math.random` and is a parameter so the choice is testable. Pure given `random`. */
export function pickRandom<T>(items: readonly T[], random: () => number = Math.random): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(random() * items.length)];
}

/** `undefined` for an empty array, so an all-clear filter drops the param from the URL. Pure. */
export function arrayParam(values: readonly string[]): string[] | undefined {
  return values.length > 0 ? [...values] : undefined;
}

/** `id` appended to `ids` unless already present. Pure. */
export function addUnique(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? [...ids] : [...ids, id];
}

/** `id` removed from `ids`. Pure. */
export function withoutId(ids: readonly string[], id: string): string[] {
  return ids.filter((existing) => existing !== id);
}
