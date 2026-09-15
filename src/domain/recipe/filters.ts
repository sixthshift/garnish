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
