import { foodForRecipe } from "../../../../api/rpc/foods";
import { getRecipe, recipeByName } from "../../../../api/rpc/recipes";
import { type IngredientReview, importDraft, type PendingLines, type RecipeDraft, tagSuggestions, tickedTags } from "../../draft";
import { type FileRecipe, type ImportedRecipe, type MealieRecipe, review } from "../../import";
import type { FoodRow, Tag, Unit } from "../../reference";
import type { DuplicateBy } from "./importSummary";

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
  const reviewed = review.rowsFromExport(recipe, { units, foods });
  return {
    imported: { from: recipe.source, url: recipe.sourceUrl, recipe, pageText: "" },
    rows: reviewed.rows,
    rowSteps: reviewed.rowSteps,
    subRecipeNames: reviewed.subRecipeNames,
  };
}

/** What Check opens on: the draft, the lines it still asks about, and what the read has to say. */
export type ImportedCheck = {
  draft: RecipeDraft;
  /** The page's picture, fetched into the form once Check opens. */
  imageUrl: string | null;
  pending: PendingLines;
  /** The line saying the model's sort did not land, when it did not. */
  note: string | null;
  /** A recipe already here from the same address or under the same name. */
  duplicate: { name: string; slug: string; by: DuplicateBy } | null;
  /** The source's new tags, offered on Check and added only when chosen (decisions.md row 171). */
  suggestedTags: string[];
};

export type ReadToCheck = {
  imported: ImportedRecipe;
  rows: readonly IngredientReview[];
  rowSteps: number[] | null;
  subRecipes: readonly string[];
  tags?: readonly Tag[];
  /** The food standing for a recipe already here under `name`; `foodForRecipeNamed` unless a test overrides it. */
  linkSubRecipeFood?: (name: string) => Promise<FoodRow | null>;
};

/**
 * A read as the draft Check opens on (decisions.md row 203). Nothing is
 * created: a food, unit or tag the library lacks is a placeholder the save
 * makes by name. The source's tags the household already has come on; new
 * ones are offered. A Tandoor export's nested recipe links to its food when
 * that recipe is already here.
 */
export async function checkFromRead({ imported, rows, rowSteps, subRecipes, tags = [], linkSubRecipeFood }: ReadToCheck) {
  const suggestions = tagSuggestions(imported.recipe.tags, imported.recipe.name, tags, imported.from === "mealie" || imported.from === "tandoor");
  const linked = new Map<string, FoodRow>();
  const creates = new Set(rows.flatMap((row) => (row.food.kind === "create" ? [row.food.name.toLowerCase()] : [])));
  for (const name of subRecipes) {
    if (!creates.has(name.toLowerCase())) continue;
    const food = await (linkSubRecipeFood ?? foodForRecipeNamed)(name);
    if (food !== null) linked.set(name.toLowerCase(), food);
  }
  const mealie = imported.from === "mealie" ? (imported.recipe as MealieRecipe) : null;
  const { draft, pending } = importDraft({
    scraped: { ...imported.recipe, tags: tickedTags(suggestions) },
    sourceUrl: imported.url,
    rows,
    knownTags: tags,
    rowSteps,
    linked,
    notes: mealie?.notes,
    rating: mealie?.rating ?? null,
  });
  return { draft, pending, suggestedTags: suggestions.suggested.filter((tag) => !tag.ticked).map((tag) => tag.name) };
}
