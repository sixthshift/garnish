// Pure helpers for the recipe list's filter bar (M12.3): folding the legacy
// single `tag` search param into the new multi-select `tags`, and small array
// utilities for the tag chips and food picker. No IO; shared by the list
// route and its filter-bar components.

export type TagMatch = "any" | "all";

/**
 * The tags the filter bar shows as selected: the legacy `tag` param (still
 * used by the recipe view's tag chip links) folded into `tags`, de-duplicated
 * and blanks dropped. Pure.
 */
export function selectedTags(tag: string | undefined, tags: readonly string[] | undefined): string[] {
  const all = [tag, ...(tags ?? [])].filter((t): t is string => Boolean(t?.trim()));
  return [...new Set(all)];
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
