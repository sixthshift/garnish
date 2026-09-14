// Parsed ingredient rows under review, and what confirming them writes into the draft.
import { type Food as FoodRow } from "../../../db/models/food/repo";
import { type ReviewRow, type CommitRef, reviewRow, type RowCommit, rowCommit } from "../../ingredient/bulkIngredients";
import { type Unit, type Food } from "../recipe";
import { parseIngredient } from "../../ingredient/parseIngredient";
import { type DraftIngredient, type RecipeDraft, type DraftPart } from "./types";
import { newIngredient, withIngredients, inRange, isTextOnly, updateIngredient } from "./ingredients";
import { foodReference } from "./vocabulary";

/** The review row type this component edits: units and foods as the editor knows them. */
export type IngredientReview = ReviewRow<Unit, FoodRow>;

/**
 * One reviewed line as a draft row (M17.5). `createdFoods`/`createdUnits` are
 * the rows Confirm found or created, keyed by the lowercased name that was
 * approved.
 *
 * A commit with no food — declined, or never proposed — is a text-only row:
 * the raw line and nothing else, which is what declining "create" has to
 * leave behind. A food that was approved but is missing from the map (the
 * creation failed) lands the same way rather than inventing a reference,
 * because a row is never worth more than the vocabulary behind it.
 * `originalText` is the pasted line either way. Pure apart from the row's id.
 */
export function reviewedIngredient(
  commit: RowCommit<Unit, FoodRow>,
  createdFoods: ReadonlyMap<string, FoodRow>,
  createdUnits: ReadonlyMap<string, Unit>,
): DraftIngredient {
  const base = { ...newIngredient(), originalText: commit.originalText };
  const food = resolveFood(commit.food, createdFoods);
  if (commit.textOnly || food === null) return base;
  return { ...base, quantity: commit.quantity, fixed: commit.fixed, note: commit.note, unit: resolveUnit(commit.unit, createdUnits), food };
}

export function resolveFood(ref: CommitRef<FoodRow>, created: ReadonlyMap<string, FoodRow>): Food | null {
  if (ref === null) return null;
  if (ref.kind === "existing") return foodReference(ref.row);
  const row = created.get(ref.name.toLowerCase());
  return row === undefined ? null : foodReference(row);
}

export function resolveUnit(ref: CommitRef<Unit>, created: ReadonlyMap<string, Unit>): Unit | null {
  if (ref === null) return null;
  if (ref.kind === "existing") return ref.row;
  return created.get(ref.name.toLowerCase()) ?? null;
}

/**
 * A saved row's `originalText`, parsed fresh against the current vocabulary
 * and turned into a review row (M17.6) — the same shape bulk add reviews a
 * pasted line with, so an unknown food or unit still asks before anything is
 * created. `key` only needs to be stable for the life of the review; the row
 * keeps its own id regardless. Pure.
 */
export function parseRowFor(originalText: string, vocabulary: { units: readonly Unit[]; foods: readonly FoodRow[] }, key: string): IngredientReview {
  return reviewRow(parseIngredient(originalText, vocabulary), key);
}

/**
 * What a parsed row's review applies to the row it came from: quantity,
 * unit, food and note from the commit — never `originalText`, so the raw
 * line the row started with survives untouched whatever the parse decided.
 * A row whose food is still undecided (declined, or never proposed) or whose
 * approved creation is missing from the map has nothing to apply: null,
 * meaning the row is left exactly as it was, text-only and all. Pure.
 */
export function parsedRowPatch(
  row: IngredientReview,
  createdFoods: ReadonlyMap<string, FoodRow>,
  createdUnits: ReadonlyMap<string, Unit>,
): Partial<DraftIngredient> | null {
  const commit = rowCommit(row);
  const food = resolveFood(commit.food, createdFoods);
  if (commit.textOnly || food === null) return null;
  return { quantity: commit.quantity, fixed: commit.fixed, note: commit.note, unit: resolveUnit(commit.unit, createdUnits), food };
}

/**
 * The draft with one row appended per reviewed line, in order, to part
 * `pi`. What the bulk-add sheet's Add commits once the review step has run.
 * No rows, or an out-of-range `pi`, returns a copy unchanged. Pure apart from
 * the rows' ids.
 */
export function addReviewedIngredients(
  draft: RecipeDraft,
  pi: number,
  commits: readonly RowCommit<Unit, FoodRow>[],
  createdFoods: ReadonlyMap<string, FoodRow>,
  createdUnits: ReadonlyMap<string, Unit>,
): RecipeDraft {
  if (!inRange(draft, pi) || commits.length === 0) return { ...draft, parts: draft.parts.slice() };
  const rows = commits.map((commit) => reviewedIngredient(commit, createdFoods, createdUnits));
  return withIngredients(draft, pi, [...draft.parts[pi]!.ingredients, ...rows]);
}

/** The positions of the rows Parse all would read: text-only rows that have a raw line. Pure. */
export function unparsedIndices(ingredients: readonly DraftIngredient[]): number[] {
  return ingredients.flatMap((row, index) => (isTextOnly(row) && (row.originalText ?? "").trim() !== "" ? [index] : []));
}

/**
 * Should the part offer Parse all? Only when it has rows, none of them has
 * resolved to a food, and at least one has a raw line to read — the same
 * "nothing here is parsed" test Mealie's alert uses, narrowed to a part. A
 * part with one matched row has been looked at, so the banner goes away. Pure.
 */
export function needsParseAll(part: DraftPart): boolean {
  if (part.ingredients.length === 0) return false;
  if (part.ingredients.some((row) => row.food)) return false;
  return unparsedIndices(part.ingredients).length > 0;
}

/**
 * Every unparsed row of `ingredients` read against the vocabulary, as review
 * rows keyed by the row's position — which is what `applyParsedRows` patches
 * by, so the key has to stay the index and not the row's id. Pure.
 */
export function parseAllRows(ingredients: readonly DraftIngredient[], vocabulary: { units: readonly Unit[]; foods: readonly FoodRow[] }): IngredientReview[] {
  return unparsedIndices(ingredients).map((index) => parseRowFor(ingredients[index]!.originalText ?? "", vocabulary, String(index)));
}

/**
 * The draft with each reviewed row applied to the row it came from in part
 * `pi`. A row whose food is still undecided has nothing to apply and is left
 * exactly as it was, text-only and all. Pure.
 */
export function applyParsedRows(
  draft: RecipeDraft,
  pi: number,
  rows: readonly IngredientReview[],
  createdFoods: ReadonlyMap<string, FoodRow>,
  createdUnits: ReadonlyMap<string, Unit>,
): RecipeDraft {
  let next = draft;
  for (const row of rows) {
    const index = Number(row.key);
    const patch = parsedRowPatch(row, createdFoods, createdUnits);
    if (!Number.isInteger(index) || patch === null) continue;
    next = updateIngredient(next, pi, index, patch);
  }
  return next;
}

