// The cross-list registry behind ReorderList: lists sharing a group register here so a drag can be hit-tested against the others.

import { rectContains, type Span } from "./reorder";

const groups = new Map<string, Map<string, HTMLElement>>();

export function registerList(group: string, key: string, element: HTMLElement): () => void {
  let members = groups.get(group);
  if (!members) {
    members = new Map();
    groups.set(group, members);
  }
  members.set(key, element);
  return () => {
    members.delete(key);
    if (members.size === 0) groups.delete(group);
  };
}

/** The other list in `group` under the pointer, if any. */
export function listAtPoint(group: string, self: string, x: number, y: number): { key: string; element: HTMLElement } | null {
  const members = groups.get(group);
  if (!members) return null;
  for (const [key, element] of members) {
    if (key === self) continue;
    if (rectContains(element.getBoundingClientRect(), x, y)) return { key, element };
  }
  return null;
}

/** The vertical spans of a list's own rows, skipping any nested list's. */
export function rowSpans(list: HTMLElement): Span[] {
  return Array.from(list.querySelectorAll<HTMLElement>(":scope > li[data-index]")).map((row) => {
    const box = row.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  });
}
