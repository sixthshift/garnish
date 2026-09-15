import { and, eq, exists, inArray, type SQL, sql } from "drizzle-orm";
import { resolveSort, type SortDir, type SortKey } from "../../../domain/recipe";
import { seededOrder } from "../../../lib/lists";
import { tag } from "../tag/schema";
import type { RecipeContext } from "./context";
import { ingredient, part, recipe, recipeTag } from "./schema";

export type ListFilter = {
  /** Case-insensitive substring of the recipe name. */
  q?: string;
  /** Tag slug; only recipes carrying that tag. Folded into `tags`. */
  tag?: string;
  /** Tag slugs; combined with `tag` (if given), de-duplicated. */
  tags?: string[];
  /** How `tags` combine: any of them (default) or all of them. */
  match?: "any" | "all";
  /** Food ids; only recipes with an ingredient using one of these foods. */
  foods?: string[];
  /** Only favourited recipes when true; unset or false is unfiltered. */
  favourite?: boolean;
  /** Sort key. Unset keeps the original newest-first order. */
  sort?: SortKey;
  /** Sort direction. Unset defaults per key, see `resolveSort`. Ignored for `sort: "random"`. */
  dir?: SortDir;
  /** Shuffle seed for `sort: "random"`: the same seed reproduces the same order. Unset shuffles with an empty seed, which is still stable across calls. */
  seed?: string;
};

/** The recipe columns a card needs. The shape `summarise` reads. */
export const summaryColumns = {
  id: recipe.id,
  slug: recipe.slug,
  name: recipe.name,
  image: recipe.image,
  rating: recipe.rating,
  prepMinutes: recipe.prepMinutes,
  cookMinutes: recipe.cookMinutes,
  lastMade: recipe.lastMade,
  favourite: recipe.favourite,
};

export type SummaryRow = Pick<
  typeof recipe.$inferSelect,
  "id" | "slug" | "name" | "image" | "rating" | "prepMinutes" | "cookMinutes" | "lastMade" | "favourite"
>;

/** Recipe name, compared the way the list page orders it. */
export const byName = sql`${recipe.name} COLLATE NOCASE`;

/**
 * `ORDER BY` for every key but "random" (handled separately in JS, see
 * `seededOrder`). `lastMade` and `rating` put nulls last regardless of `dir` —
 * an unrated or never-made recipe reads as "not applicable", not as the lowest
 * value. A name tie-break, then `recipe.id`, keeps the order fully determinate.
 */
export function orderClause(sort: Exclude<SortKey, "random">, dir: SortDir): SQL[] {
  const d = dir === "asc" ? sql`ASC` : sql`DESC`;
  switch (sort) {
    case "name":
      return [sql`${byName} ${d}`, sql`${recipe.id}`];
    case "updated":
      return [sql`${recipe.updatedAt} ${d}`, byName, sql`${recipe.id}`];
    case "lastMade":
      return [sql`(${recipe.lastMade} IS NULL)`, sql`${recipe.lastMade} ${d}`, byName, sql`${recipe.id}`];
    case "rating":
      return [sql`(${recipe.rating} IS NULL)`, sql`${recipe.rating} ${d}`, byName, sql`${recipe.id}`];
    case "created":
      return [sql`${recipe.createdAt} ${d}`, byName, sql`${recipe.id}`];
  }
}

/**
 * Card rows, newest first by default (`sort`/`dir` change that, see
 * `resolveSort`; `sort: "random"` shuffles by `seed` instead, see
 * `seededOrder`). `q` is a name substring; `tag` and `tags` (tag slugs) are
 * combined and de-duplicated, then matched by `match` (any, the default, or
 * all); `foods` (food ids) matches any ingredient using one of them;
 * `favourite` true restricts to favourites.
 */
export function listRows({ dz }: RecipeContext, filter: ListFilter = {}): SummaryRow[] {
  const q = filter.q?.trim() || null;
  const tagSlugs = [...new Set([filter.tag, ...(filter.tags ?? [])].map((t) => t?.trim()).filter((t): t is string => Boolean(t)))];
  const foodIds = [...new Set((filter.foods ?? []).map((f) => f.trim()).filter(Boolean))];
  const match = filter.match ?? "any";

  /** Recipes carrying the tag whose slug satisfies `slugs`. */
  const hasTag = (slugs: SQL) =>
    exists(
      dz
        .select({ one: sql`1` })
        .from(recipeTag)
        .innerJoin(tag, eq(tag.id, recipeTag.tagId))
        .where(and(eq(recipeTag.recipeId, recipe.id), slugs))
    );

  const clauses: (SQL | undefined)[] = [];

  if (q) clauses.push(sql`instr(lower(${recipe.name}), lower(${q})) > 0`);

  if (tagSlugs.length > 0) {
    if (match === "all") for (const slug of tagSlugs) clauses.push(hasTag(eq(tag.slug, slug)));
    else clauses.push(hasTag(inArray(tag.slug, tagSlugs)));
  }

  if (foodIds.length > 0) {
    clauses.push(
      exists(
        dz
          .select({ one: sql`1` })
          .from(part)
          .innerJoin(ingredient, eq(ingredient.partId, part.id))
          .where(and(eq(part.recipeId, recipe.id), inArray(ingredient.foodId, foodIds)))
      )
    );
  }

  if (filter.favourite) clauses.push(eq(recipe.favourite, true));

  const where = clauses.length > 0 ? and(...clauses) : undefined;
  const { key: sort, dir } = resolveSort(filter.sort, filter.dir);
  const query = dz.select(summaryColumns).from(recipe).where(where);

  if (sort === "random") return seededOrder(query.all(), filter.seed ?? "");
  return query.orderBy(...orderClause(sort, dir)).all();
}
