import { randomUuid } from "../../lib/id";
import type { ScrapedRecipe } from "../import";
import type { RowCommit } from "../ingredient";
import { suggestLinks } from "../recipe";
import type { FoodRow, Tag, Unit } from "../reference";
import { emptyDraft } from "./draft";
import { reviewedIngredient } from "./review";
import { newStep } from "./steps";
import type { DraftPart, RecipeDraft } from "./types";
import { tagsFromNames } from "./vocabulary";
// A draft from a scraped or imported recipe: the import review's starting point.

/**
 * `part` with `suggestLinks` run over its steps, so an imported
 * recipe arrives with its links filled for review. `suggestLinks` needs an
 * id on every row to name it in a link; the scraper's rows already carry
 * one (`newStep`, `reviewedIngredient`), but a fresh id is given here too,
 * defensively, rather than trusting that.
 */
export function withSuggestedLinks(part: DraftPart): DraftPart {
  const ingredients = part.ingredients.map((ingredient) => ({
    ...ingredient,
    id: ingredient.id ?? randomUuid(),
    food: ingredient.food ?? null,
  }));
  const steps = suggestLinks({
    ingredients,
    steps: part.steps.map((step) => ({
      ...step,
      id: step.id ?? randomUuid(),
      text: step.text ?? "",
      ingredientIds: step.ingredientIds ?? [],
    })),
  });
  return { ...part, ingredients, steps };
}

/**
 * `part` with the links the source already knew: `stepOfRow[i]` is the
 * step that owns the part's i-th row, or -1 for a row no step claimed. Used
 * instead of `suggestLinks` when the export says outright which step a row was
 * written under — Tandoor's steps own their ingredients — because a stated
 * answer beats a guessed one.
 */
export function withStepRows(part: DraftPart, stepOfRow: readonly number[]): DraftPart {
  const ingredients = part.ingredients.map((ingredient) => ({
    ...ingredient,
    id: ingredient.id ?? randomUuid(),
    food: ingredient.food ?? null,
  }));
  const steps = part.steps.map((step, stepIndex) => ({
    ...step,
    id: step.id ?? randomUuid(),
    text: step.text ?? "",
    ingredientIds: ingredients.filter((_, row) => stepOfRow[row] === stepIndex).map((ingredient) => ingredient.id),
  }));
  return { ...part, ingredients, steps };
}

/**
 * A scraped recipe and its reviewed ingredient lines as a draft. The parts are
 * the source's own, and each row goes back on the part
 * whose line it was parsed from: the review's rows are the parts' lines
 * flattened in part order, so the parts' own counts are the allocation
 * and nothing has to carry it alongside. A schema.org page puts every line on
 * the unnamed body because that is all its markup can say; a Mealie or Tandoor
 * export, or a model that read the headings, says more, and this reads all of
 * them the same way. Each part then runs through `suggestLinks`, so
 * the draft arrives with its step-ingredient links already filled for review.
 * Pure apart from the ids it fills in.
 */
export function draftFromScraped(opts: {
  scraped: ScrapedRecipe;
  sourceUrl: string;
  commits: readonly RowCommit<Unit, FoodRow>[];
  createdFoods: ReadonlyMap<string, FoodRow>;
  createdUnits: ReadonlyMap<string, Unit>;
  knownTags?: readonly Tag[];
  /**
   * Which step of its part each commit was written under, by index, -1 for
   * none. Given, the links are taken from it rather than guessed by
   * `suggestLinks`; only Tandoor's steps know.
   */
  rowSteps?: readonly number[];
  /** Notes the source carried (Mealie's `notes`). */
  notes?: readonly { title: string; text: string }[];
  /** A rating the source carried, 1 to 5. */
  rating?: number | null;
}): RecipeDraft {
  const { scraped, sourceUrl, commits, createdFoods, createdUnits, knownTags = [], rowSteps, notes = [], rating = null } = opts;
  const rows = commits.map((commit) => reviewedIngredient(commit, createdFoods, createdUnits));

  const parts: DraftPart[] = scraped.parts.map((part) => ({
    id: randomUuid(),
    name: part.name,
    ingredients: [],
    steps: part.steps.map((step) => newStep(step)),
  }));
  // A source with no parts at all still needs somewhere to put its rows.
  if (parts.length === 0) parts.push({ id: randomUuid(), name: "", ingredients: [], steps: [] });
  // The part each row came off, by index: part 0 owns its first
  // `parts[0].ingredients.length` rows, and so on down the list. A row past the
  // last line — nothing produces one today — falls to the first part rather
  // than being dropped.
  const rowParts = scraped.parts.flatMap((part, index) => part.ingredients.map(() => index));
  rows.forEach((row, index) => (parts[rowParts[index] ?? 0] ?? parts[0]!).ingredients.push(row));

  // The steps each part's rows were written under, in the order the rows were
  // pushed onto that part, so `withStepRows` can read them off positionally.
  const stepsPerPart: number[][] = parts.map(() => []);
  if (rowSteps !== undefined) {
    rows.forEach((_, index) => stepsPerPart[rowParts[index] ?? 0]?.push(rowSteps[index] ?? -1));
  }
  const linked = parts.map((part, index) => (rowSteps === undefined ? withSuggestedLinks(part) : withStepRows(part, stepsPerPart[index] ?? [])));

  return {
    ...emptyDraft(),
    name: scraped.name,
    description: scraped.description,
    recipeServings: scraped.servings,
    // A yield of "24 biscuits" is worth keeping whole; a bare "4" is servings
    // and nothing more, so it would only read as "4" twice.
    recipeYieldQuantity: scraped.yieldText === "" ? 0 : scraped.servings,
    recipeYield: scraped.yieldText,
    prepTime: scraped.prepMinutes,
    performTime: scraped.cookMinutes,
    sourceUrl: sourceUrl.trim() === "" ? null : sourceUrl.trim(),
    rating,
    notes: notes.filter((note) => note.text.trim() !== "" || note.title.trim() !== "").map((note) => ({ title: note.title, text: note.text })),
    tags: tagsFromNames(scraped.tags, knownTags),
    parts: linked.length > 0 ? linked : emptyDraft().parts,
  };
}
