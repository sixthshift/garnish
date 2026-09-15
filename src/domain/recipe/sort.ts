// Pure helpers for the recipe list's sort menu and dice button (M12.4). No
// IO; shared by the repository (src/db/models/recipe/repo.ts), the server function
// (src/server/recipes.ts) and the list route's SortMenu.

export type SortKey = "name" | "created" | "updated" | "lastMade" | "rating" | "random";
export type SortDir = "asc" | "desc";

/** Ascending reads naturally for names; every other key defaults to newest/highest first. Pure. */
export function defaultDir(key: SortKey): SortDir {
  return key === "name" ? "asc" : "desc";
}

/** `sort`/`dir` as the repository and the sort menu apply them: unset falls back to "created" (the list's original newest-first order), then to that key's default direction. Pure. */
export function resolveSort(key?: SortKey, dir?: SortDir): { key: SortKey; dir: SortDir } {
  const resolvedKey = key ?? "created";
  return { key: resolvedKey, dir: dir ?? defaultDir(resolvedKey) };
}

export type SortOption = { key: SortKey; dir: SortDir; label: string };

/**
 * The sort menu's entries, in display order. Mealie's sort control offers one
 * directional label per option rather than a separate direction toggle, so
 * each key gets two entries (bar `random`, which has no meaningful direction
 * — reshuffling is done with a fresh seed, see `newSeed` below).
 */
export const SORT_OPTIONS: readonly SortOption[] = [
  { key: "name", dir: "asc", label: "Name (A–Z)" },
  { key: "name", dir: "desc", label: "Name (Z–A)" },
  { key: "created", dir: "desc", label: "Newest created" },
  { key: "created", dir: "asc", label: "Oldest created" },
  { key: "updated", dir: "desc", label: "Recently updated" },
  { key: "updated", dir: "asc", label: "Least recently updated" },
  { key: "lastMade", dir: "desc", label: "Made most recently" },
  { key: "lastMade", dir: "asc", label: "Made least recently" },
  { key: "rating", dir: "desc", label: "Highest rated" },
  { key: "rating", dir: "asc", label: "Lowest rated" },
  { key: "random", dir: "desc", label: "Random" },
];
