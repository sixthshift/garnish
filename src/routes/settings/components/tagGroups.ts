import type { Tag } from "../../../domain/reference";

/** One letter's tags for the Tags tab's A–Z grouped list. */
export type TagGroup = { letter: string; tags: Tag[] };

/**
 * Tags grouped by the first letter of their name (upper-cased), each group's
 * tags sorted by name; a name starting with anything but A–Z falls in "#".
 * Groups come back A–Z with "#" last, as Mealie's tag page does. Pure.
 */
export function groupTagsAZ(tags: readonly Tag[]): TagGroup[] {
  const groups = new Map<string, Tag[]>();
  for (const tag of tags) {
    const first = tag.name.trim().charAt(0).toUpperCase();
    const letter = first >= "A" && first <= "Z" ? first : "#";
    const bucket = groups.get(letter);
    if (bucket) bucket.push(tag);
    else groups.set(letter, [tag]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)))
    .map(([letter, group]) => ({ letter, tags: group.slice().sort((a, b) => a.name.localeCompare(b.name, "en-AU", { sensitivity: "base" })) }));
}
