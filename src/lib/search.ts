/**
 * Where ArrowUp/ArrowDown move the highlighted result. Clamps at both ends
 * (a search result list is not a menu that wraps) and ignores every other
 * key, so Home/End and the arrow keys' usual meaning inside the text input
 * — caret movement — are left alone.
 */
export function nextSearchIndex(current: number, count: number, key: string): number | null {
  if (count <= 0) return null;
  if (key !== "ArrowDown" && key !== "ArrowUp") return null;
  if (current < 0) return key === "ArrowDown" ? 0 : count - 1;
  return key === "ArrowDown" ? Math.min(current + 1, count - 1) : Math.max(current - 1, 0);
}

/** The result Enter (or a click) would open, or null when `index` is out of range. */
export function selectedResult<T>(results: readonly T[], index: number): T | null {
  return index >= 0 && index < results.length ? results[index]! : null;
}

/** Keeps a selection index in range as the result list changes size (e.g. a new search narrows it). */
export function clampSelection(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(index, 0), count - 1);
}

/** How long typing pauses before the URL (and so the loader) follows it. */
export const SEARCH_DEBOUNCE_MS = 300;

/** An empty or whitespace-only value drops the param from the URL. Pure. */
export function searchParam(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
