import { draftFromScraped, type IngredientReview, type RecipeDraft } from "../../../../domain/draft";
import { type FileRecipe, type ImportedRecipe, type MealieRecipe, review } from "../../../../domain/import";
import { pendingCreations, rowCommit } from "../../../../domain/ingredient";
import type { FoodRow, Tag, Unit } from "../../../../domain/reference";
import { findOrCreateFood, foodForRecipe } from "../../../../server/fns/foods";
import { getRecipe, recipeByName } from "../../../../server/fns/recipes";
import { findOrCreateUnit } from "../../../../server/fns/units";

/**
 * The food that is the recipe of this name ("Make this a food"), when
 * that recipe is already here. A Tandoor export's nested recipe names its
 * child; if the child has been imported already, the row can point straight at
 * it. If it has not — the usual case, since an export is imported one recipe
 * at a time — this is null and the food is created plain, to be linked later.
 * A failed lookup is "not here", never a failed import.
 */
export async function foodForRecipeNamed(name: string): Promise<FoodRow | null> {
  try {
    const found = await recipeByName({ data: { name } });
    if (found === null) return null;
    const doc = await getRecipe({ data: { slug: found.slug } });
    return await foodForRecipe({ data: { recipeId: doc.id } });
  } catch {
    return null;
  }
}

/** What one recipe out of an upload puts on the review. */
export type UploadReview = {
  imported: ImportedRecipe;
  rows: IngredientReview[];
  /** Which step of the row's part owns the row; only a Tandoor export knows. */
  rowSteps: number[] | null;
  /** The nested recipes the rows stand for; only a Tandoor export knows. */
  subRecipeNames: string[];
};

/** One recipe out of an upload, onto the same review the URL import uses. */
export function reviewOfUpload(recipe: FileRecipe, units: readonly Unit[], foods: readonly FoodRow[]): UploadReview {
  const reviewed = review.isTandoor(recipe)
    ? review.rowsFromTandoor(recipe, { units, foods })
    : { ...review.rowsFromMealie(recipe, { units, foods }), rowSteps: null, subRecipeNames: [] as string[] };
  return {
    imported: { from: recipe.source, url: recipe.sourceUrl, recipe, pageText: "" },
    rows: reviewed.rows,
    rowSteps: reviewed.rowSteps,
    subRecipeNames: reviewed.subRecipeNames,
  };
}

export type ReviewToCreate = {
  imported: ImportedRecipe;
  rows: readonly IngredientReview[];
  rowSteps: number[] | null;
  subRecipes: readonly string[];
  tags?: readonly Tag[];
  /** The food standing for a recipe already here under `name`; `foodForRecipeNamed` unless a test overrides it. */
  linkSubRecipeFood?: (name: string) => Promise<FoodRow | null>;
};

/** Create only what the reviewer approved, and return the draft the editor opens on. */
export async function draftFromReview({ imported, rows, rowSteps, subRecipes, tags, linkSubRecipeFood }: ReviewToCreate): Promise<RecipeDraft> {
  const pending = pendingCreations(rows);
  const createdFoods = new Map<string, FoodRow>();
  const nested = new Set(subRecipes.map((name) => name.toLowerCase()));
  for (const name of pending.foods) {
    // A row that stands for another recipe in the export gets that
    // recipe's food when the recipe is already here; otherwise a
    // plain food, exactly as any other new name does.
    const linked = nested.has(name.toLowerCase()) ? await (linkSubRecipeFood ?? foodForRecipeNamed)(name) : null;
    createdFoods.set(name.toLowerCase(), linked ?? (await findOrCreateFood({ data: { name } })));
  }
  const createdUnits = new Map<string, Unit>();
  for (const name of pending.units) createdUnits.set(name.toLowerCase(), await findOrCreateUnit({ data: { name } }));
  const mealie = imported.from === "mealie" ? (imported.recipe as MealieRecipe) : null;

  return draftFromScraped({
    scraped: imported.recipe,
    sourceUrl: imported.url,
    commits: rows.map(rowCommit),
    createdFoods,
    createdUnits,
    knownTags: tags,
    rowSteps: rowSteps ?? undefined,
    notes: mealie?.notes,
    rating: mealie?.rating ?? null,
  });
}
