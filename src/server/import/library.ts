// A whole Mealie or Tandoor export brought in at once (decisions.md row 201): every recipe saved without a
// review, foods and units matched by name and created where nothing matches, recipes already here skipped.

import foods from "../../db/models/food/repo";
import recipes from "../../db/models/recipe/repo";
import tags from "../../db/models/tag/repo";
import units from "../../db/models/unit/repo";
import { draftFromScraped, tagSuggestions, tickedTags, validateDraft } from "../../domain/recipes/draft";
import { type FileRecipe, type MealieRecipe, review } from "../../domain/recipes/import";
import { pendingCreations, rowCommit } from "../../domain/recipes/ingredient";
import type { FoodRow, Unit } from "../../domain/recipes/reference";
import { sniffImage } from "../../lib/imageFile";
import { dataUrlFile } from "../../lib/images";
import { storeImage } from "../api/images";

/** A recipe the import wrote, or the one already here that it left alone. */
export type LibraryRecipe = { name: string; slug: string };

/** What a whole-library import did. */
export type LibraryReport = {
  imported: LibraryRecipe[];
  /** Already here, by source address or by name: the one here is named. */
  skipped: LibraryRecipe[];
  /** Could not be saved, with why. Nothing of these was kept but the foods and units they named. */
  failed: { name: string; error: string }[];
  foodsCreated: number;
  unitsCreated: number;
};

/** What an export holds, before anything is written: for the confirm. */
export type LibraryCheck = { recipes: number; alreadyHere: number; names: string[] };

/** The recipe already here that `recipe` would duplicate: same source address, else same name. */
function existing(recipe: FileRecipe): LibraryRecipe | null {
  const url = recipe.sourceUrl.trim();
  const found = (url !== "" ? recipes.query({ by: "url", url })[0] : undefined) ?? recipes.query({ by: "name", name: recipe.name.trim() })[0];
  return found ? { name: found.name, slug: found.slug } : null;
}

/** Count what an export holds and how much of it is already here. Writes nothing. */
export function checkLibrary(found: readonly FileRecipe[]): LibraryCheck {
  return {
    recipes: found.length,
    alreadyHere: found.filter((recipe) => existing(recipe) !== null).length,
    names: found.map((recipe) => recipe.name),
  };
}

/**
 * Children before parents: a Tandoor recipe nested in another is saved first,
 * so the parent's row can point at the food that stands for it. One level only
 * (CLAUDE.md), so one pass over the names is enough. Pure.
 */
export function childrenFirst(found: readonly FileRecipe[]): FileRecipe[] {
  const nested = new Set<string>();
  for (const recipe of found) {
    if (!review.isTandoor(recipe)) continue;
    for (const part of recipe.parts) for (const row of part.rows) if (row.recipeName !== "") nested.add(row.recipeName.toLowerCase());
  }
  const isChild = (recipe: FileRecipe) => nested.has(recipe.name.toLowerCase());
  return [...found.filter(isChild), ...found.filter((recipe) => !isChild(recipe))];
}

/** The food that is the recipe of this name, when that recipe is here; null otherwise. */
function foodForRecipeNamed(name: string): FoodRow | null {
  const found = recipes.query({ by: "name", name })[0];
  const recipe = found ? recipes.getById(found.id) : null;
  if (!recipe) return null;
  const food = foods.findOrCreate(recipe.name);
  return food.recipeId === recipe.id ? food : (foods.update(food.id, { recipeId: recipe.id }) ?? food);
}

/** The recipe's picture out of the export, stored and set. A picture that fails costs the recipe nothing. */
async function keepImage(recipeId: string, image: string | null): Promise<void> {
  if (image === null || !image.startsWith("data:")) return;
  try {
    const bytes = new Uint8Array(await dataUrlFile(image).arrayBuffer());
    const ext = sniffImage(bytes);
    if (ext === null) return;
    recipes.ref(recipeId).setImage(await storeImage(recipeId, ext, bytes));
  } catch {
    // The recipe stands without it.
  }
}

/**
 * Save every recipe in `found` that is not already here. Each is matched
 * against the foods and units as they stand when its turn comes, so a food one
 * recipe created is matched, not made again, by the next. A recipe that fails
 * is reported and the rest go on.
 */
export async function importLibrary(found: readonly FileRecipe[]): Promise<LibraryReport> {
  const report: LibraryReport = { imported: [], skipped: [], failed: [], foodsCreated: 0, unitsCreated: 0 };
  const vocabulary = { foods: foods.list() as FoodRow[], units: units.list() };
  const knownFoods = new Set(vocabulary.foods.map((food) => food.id));
  const knownUnits = new Set(vocabulary.units.map((unit) => unit.id));

  for (const recipe of childrenFirst(found)) {
    const name = recipe.name.trim();
    if (name === "") {
      report.failed.push({ name: "(no name)", error: "The recipe has no name" });
      continue;
    }
    const here = existing(recipe);
    if (here !== null) {
      report.skipped.push(here);
      continue;
    }
    try {
      const reviewed = review.rowsFromExport(recipe, vocabulary);
      const rows = reviewed.rows.map(review.acceptProposals);
      const pending = pendingCreations(rows);
      const nested = new Set(reviewed.subRecipeNames.map((sub) => sub.toLowerCase()));

      const createdFoods = new Map<string, FoodRow>();
      for (const foodName of pending.foods) {
        const food = (nested.has(foodName.toLowerCase()) ? foodForRecipeNamed(foodName) : null) ?? foods.findOrCreate(foodName);
        createdFoods.set(foodName.toLowerCase(), food);
        if (!knownFoods.has(food.id)) {
          knownFoods.add(food.id);
          vocabulary.foods.push(food);
          report.foodsCreated += 1;
        }
      }
      const createdUnits = new Map<string, Unit>();
      for (const unitName of pending.units) {
        const unit = units.findOrCreate(unitName);
        createdUnits.set(unitName.toLowerCase(), unit);
        if (!knownUnits.has(unit.id)) {
          knownUnits.add(unit.id);
          vocabulary.units.push(unit);
          report.unitsCreated += 1;
        }
      }

      const known = tags.list();
      // The export's own tags are the household's own, so every one is kept, as the review ticks them.
      const tagNames = tickedTags(tagSuggestions(recipe.tags, recipe.name, known, true));
      const mealie = recipe.source === "mealie" ? (recipe as MealieRecipe) : null;
      const draft = draftFromScraped({
        scraped: { ...recipe, tags: tagNames },
        sourceUrl: recipe.sourceUrl,
        commits: rows.map(rowCommit),
        createdFoods,
        createdUnits,
        knownTags: known,
        rowSteps: reviewed.rowSteps ?? undefined,
        notes: mealie?.notes,
        rating: mealie?.rating ?? null,
      });
      const valid = validateDraft(draft);
      if (!valid.ok) throw new Error(Object.values(valid.errors)[0] ?? "The recipe did not validate");
      const stored = recipes.create(valid.data);
      await keepImage(stored.id, recipe.image);
      report.imported.push({ name: stored.name, slug: stored.slug });
    } catch (error) {
      report.failed.push({ name, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return report;
}
