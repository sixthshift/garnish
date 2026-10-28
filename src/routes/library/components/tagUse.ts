// Ranking tags by use for the recipe list (decisions.md row 173): the filter
// bar's shelves, and the order a card shows its few tags in.
import { type Tag, type TagUsage, tagKey } from "../../../domain/reference";

/** How many of the most-used tags the bar shows before "More tags". */
export const TOP_TAGS = 8;

/**
 * The tags the bar shows up front and those behind "More tags" (decisions.md
 * row 173): the `TOP_TAGS` most used, ties by name, plus any selected tag, so
 * a filter in force never hides; the rest by use, narrowed to those whose name
 * contains `find`. Pure.
 */
export function tagShelves(all: readonly TagUsage[], selected: readonly string[], find: string): { top: TagUsage[]; more: TagUsage[] } {
  const byUse = [...all].sort((a, b) => b.recipes - a.recipes || a.name.localeCompare(b.name, "en-AU"));
  const top = byUse.filter((tag, index) => index < TOP_TAGS || selected.includes(tag.slug));
  const key = tagKey(find);
  const more = byUse.filter((tag) => !top.includes(tag) && (key === "" || tagKey(tag.name).includes(key)));
  return { top, more };
}

/**
 * `tags` with the most used first, ties by name, so a card's three are the
 * household's main shelves rather than the alphabet's first. A tag missing
 * from `usage` counts as unused. Pure.
 */
export function tagsByUse<T extends Tag>(tags: readonly T[], usage: readonly TagUsage[]): T[] {
  const count = new Map(usage.map((tag) => [tag.id, tag.recipes]));
  return [...tags].sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0) || a.name.localeCompare(b.name, "en-AU"));
}
