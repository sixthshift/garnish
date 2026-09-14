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
