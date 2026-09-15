// Name and slug helpers: trimming, slugs as python-slugify makes them, unique slugs, and a LIKE pattern. Pure.

/** Trimmed name; throws when nothing is left. Uniqueness is the schema's job. */
export function cleanName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") throw new Error("name is required");
  return trimmed;
}

/** "Crème Brûlée!" -> "creme-brulee", as python-slugify does for Mealie. Empty when nothing survives. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * First of `base`, `base-2`, `base-3`, ... that `taken` does not claim.
 * An empty base becomes `untitled`.
 */
export function uniqueSlug(base: string, taken: (slug: string) => boolean): string {
  const root = base || "untitled";
  if (!taken(root)) return root;
  for (let n = 2; ; n++) {
    const candidate = `${root}-${n}`;
    if (!taken(candidate)) return candidate;
  }
}

/**
 * SQL LIKE pattern for a case-insensitive substring search on a name:
 * `%` and `_` in `q` are escaped (pair with `ESCAPE '\'`), then wrapped in `%`.
 */
export function likePattern(q: string): string {
  return `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
