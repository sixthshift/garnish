// Reviewing a pasted block's rows: an unresolved food or unit starts declined, so confirming a paste untouched creates nothing.

import type { FoodCandidate } from "./parseFood";
import { type ParsedIngredient, parseIngredient } from "./parseIngredient";
import type { UnitCandidate } from "./parseUnit";

/** What a reviewer decided about one slot: leave it unresolved, use an existing row, or create one by name. */
export type Choice<T> = { kind: "none" } | { kind: "existing"; row: T } | { kind: "create"; name: string };

/**
 * One pasted line, parsed and awaiting review. `unitText`/`foodText` carry the
 * text the parser could not resolve — the name a `create` would use — and are
 * empty when the slot matched or the parser proposed nothing.
 */
export type ReviewRow<U, F> = {
  /** Stable key for React and for the update helpers: the row's position in the paste. */
  key: string;
  originalText: string;
  quantity: number | null;
  /** The upper bound of a range, "5–6 tbsp"; null when the amount is one number. */
  quantityMax: number | null;
  fixed: boolean;
  note: string;
  unitText: string;
  foodText: string;
  unit: Choice<U>;
  food: Choice<F>;
};

/** A resolved slot on the way into the draft, or null for "no row here". */
export type CommitRef<T> = { kind: "existing"; row: T } | { kind: "create"; name: string } | null;

/** What one reviewed row commits: a structured row, or a text-only one carrying just the raw line. */
export type RowCommit<U, F> = {
  textOnly: boolean;
  originalText: string;
  quantity: number | null;
  quantityMax: number | null;
  fixed: boolean;
  note: string;
  unit: CommitRef<U>;
  food: CommitRef<F>;
};

/** How a row reads in the review list: resolved, waiting on a decision, or committing as text only. */
export type RowStatus = "matched" | "review" | "text";

/** One parsed line as a review row, everything unmatched declined by default. Pure. */
export function reviewRow<U extends UnitCandidate, F extends FoodCandidate>(parsed: ParsedIngredient<U, F>, key: string): ReviewRow<U, F> {
  return {
    key,
    originalText: parsed.originalText,
    quantity: parsed.quantity,
    quantityMax: parsed.quantityMax,
    fixed: parsed.fixed,
    note: parsed.note,
    // Only a proposal is worth showing: a matched slot has nothing to create.
    unitText: parsed.unit === null ? parsed.unitText.trim() : "",
    foodText: parsed.food === null ? parsed.foodText.trim() : "",
    unit: parsed.unit === null ? { kind: "none" } : { kind: "existing", row: parsed.unit },
    food: parsed.food === null ? { kind: "none" } : { kind: "existing", row: parsed.food },
  };
}

/** Every pasted line parsed and turned into a review row, in order. Keys are positions, so they are stable while the list is. Pure. */
export function reviewRows<U extends UnitCandidate, F extends FoodCandidate>(
  lines: readonly string[],
  vocabulary: { units: readonly U[]; foods: readonly F[] }
): ReviewRow<U, F>[] {
  return lines.map((line, index) => reviewRow(parseIngredient(line, vocabulary), String(index)));
}

/** A choice as a commit reference: a declined slot, and a create with nothing to name, are both null. Pure. */
function commitRef<T>(choice: Choice<T>): CommitRef<T> {
  if (choice.kind === "existing") return { kind: "existing", row: choice.row };
  if (choice.kind === "create") {
    const name = choice.name.trim();
    return name === "" ? null : { kind: "create", name };
  }
  return null;
}

/**
 * What one reviewed row commits. No food — declined, or never proposed —
 * means a text-only row: the raw line and nothing else, because an amount or a
 * unit with nothing to measure is not a row anyone can scale or shop from.
 * Pure.
 */
export function rowCommit<U, F>(row: ReviewRow<U, F>): RowCommit<U, F> {
  const food = commitRef(row.food);
  if (food === null) {
    return { textOnly: true, originalText: row.originalText, quantity: null, quantityMax: null, fixed: false, note: "", unit: null, food: null };
  }
  const unit = commitRef(row.unit);
  return {
    textOnly: false,
    originalText: row.originalText,
    quantity: row.quantity,
    quantityMax: row.quantityMax,
    fixed: row.fixed,
    // A word read as a unit the library lacks ("large", "packet") stays on the line when no unit is made of it (decisions.md row 221).
    note: unit === null ? keptWord(row.unitText, row.note) : row.note,
    unit,
    food,
  };
}

/** `note` led by `word`, unless the word is blank. Pure. */
export function keptWord(word: string, note: string): string {
  return [word.trim(), note].filter((part) => part !== "").join(", ");
}

/** How a row reads: `matched` once its food resolves, `review` while a proposal is still undecided, `text` when it will commit as a raw line. Pure. */
export function rowStatus<U, F>(row: ReviewRow<U, F>): RowStatus {
  if (row.food.kind !== "none") return row.unit.kind === "none" && row.unitText !== "" ? "review" : "matched";
  return row.foodText === "" ? "text" : "review";
}

/** Distinct names, first spelling kept, compared case-insensitively. Pure. */
function distinct(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(name);
  }
  return kept;
}

/**
 * The names Confirm must find-or-create, once each: only what a reviewer
 * approved, and only on rows that commit structured — a row whose food was
 * declined creates nothing at all, not even the unit it named. Pure.
 */
export function pendingCreations<U, F>(rows: readonly ReviewRow<U, F>[]): { foods: string[]; units: string[] } {
  const foods: string[] = [];
  const units: string[] = [];
  for (const row of rows) {
    const commit = rowCommit(row);
    if (commit.food?.kind === "create") foods.push(commit.food.name);
    if (commit.unit?.kind === "create") units.push(commit.unit.name);
  }
  return { foods: distinct(foods), units: distinct(units) };
}
