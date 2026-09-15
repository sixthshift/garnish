import { and, eq, ne, sql } from "drizzle-orm";
import type { ParsedRecipeInput } from "../../../domain/recipe";
import type { Food, Tag, Unit } from "../../../domain/reference";
import { slugify, uniqueSlug } from "../../../lib/names";
import { childWriters } from "./children";
import type { RecipeContext } from "./context";
import type { Readers } from "./read";
import { recipe } from "./schema";

/** `strftime(...)`, matching the column defaults; an update stamps it by hand. */
export const nowUtc = sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

export type Writers = ReturnType<typeof writers>;

export function writers(ctx: RecipeContext, { rowById }: Pick<Readers, "rowById">) {
  const { dz, units, foods, aisles, tags } = ctx;

  // --- Reference resolution ------------------------------------------------
  // By id when that row exists, else by name (NOCASE), else a new row copying
  // the document's attributes. The id the caller sent is not kept for new rows.
  // Existing reference rows are never modified by a recipe write.

  function resolveAisle(ref: Food["aisle"]): string | null {
    if (!ref) return null;
    return (aisles.get(ref.id) ?? aisles.findOrCreate(ref.name)).id;
  }

  function resolveUnit(ref: Unit | null): string | null {
    if (!ref) return null;
    const existing = units.get(ref.id) ?? units.getByName(ref.name);
    if (existing) return existing.id;
    return units.create({
      name: ref.name,
      pluralName: ref.pluralName,
      abbreviation: ref.abbreviation,
      useAbbreviation: ref.useAbbreviation,
      fraction: ref.fraction,
      standardQuantity: ref.standardQuantity,
      standardUnitId: ref.standardUnitId && units.get(ref.standardUnitId) ? ref.standardUnitId : null,
    }).id;
  }

  function resolveFood(ref: Food | null): string | null {
    if (!ref) return null;
    const existing = foods.get(ref.id) ?? foods.getByName(ref.name);
    if (existing) return existing.id;
    return foods.create({
      name: ref.name,
      pluralName: ref.pluralName,
      aliases: ref.aliases,
      aisleId: resolveAisle(ref.aisle),
      recipeId: ref.recipeId && rowById(ref.recipeId) ? ref.recipeId : null,
      skipShopping: ref.skipShopping,
    }).id;
  }

  function resolveTag(ref: Tag): string {
    return (tags.get(ref.id) ?? tags.findOrCreate(ref.name)).id;
  }

  // --- Write ---------------------------------------------------------------

  function slugFor(name: string, ownId: string): string {
    return uniqueSlug(slugify(name), (s) => {
      const clash = dz
        .select({ id: recipe.id })
        .from(recipe)
        .where(and(eq(recipe.slug, s), ne(recipe.id, ownId)))
        .get();
      return clash !== undefined;
    });
  }

  /** The recipe row's columns as the document spells them; the id and stamps are the caller's. */
  function recipeValues(doc: ParsedRecipeInput) {
    return {
      name: doc.name,
      description: doc.description,
      image: doc.image,
      rating: doc.rating,
      lastMade: doc.lastMade,
      servings: doc.recipeServings,
      yieldQuantity: doc.recipeYieldQuantity,
      yieldUnitId: resolveUnit(doc.yieldUnit),
      yieldText: doc.recipeYield,
      prepMinutes: doc.prepTime,
      cookMinutes: doc.performTime,
      sourceUrl: doc.sourceUrl,
      favourite: doc.favourite,
    };
  }

  const { writeChildren, partRows, stepTexts, replaceSteps } = childWriters(ctx, { resolveUnit, resolveFood, resolveTag });

  return { slugFor, recipeValues, writeChildren, partRows, stepTexts, replaceSteps };
}
