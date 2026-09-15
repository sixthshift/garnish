// The review step between a pasted block of ingredient lines and the rows it
// becomes (M17.5). Pure: no IO, no ids invented, importable by the client.
//
// `parseIngredient` (M17.4) reads a line and reports what it could not
// resolve; it never creates anything. This module holds what a reviewer then
// decides about each line, and what that decision commits to — the part
// decisions.md row 47 calls the review step, and the reason it exists:
// auto-creating every unmatched food fills the food table with near-duplicates
// ("flour", "plain flour", "Plain Flour") that the merge tools then have to
// clean up. So a proposal is never a creation. Each unresolved slot starts at
// `{ kind: "none" }` — declined — and only an explicit `create` or a picked
// `existing` moves it, which means confirming a paste untouched creates
// nothing at all.
//
// One rule ties the two slots together: the food is what makes a row
// structured. A row with no food commits as text only — no amount, no unit, no
// note, just the raw line in `originalText`, exactly the shape bulk add used
// to produce for every line. A row with a food but no unit is a normal
// structured row ("3 lemons"); declining a unit only drops the unit.
//
// `originalText` is the line as pasted either way, on a fully matched row as
// much as on a declined one, so nothing a paste contained is ever lost.
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

/** The row with its food choice replaced. Pure. */
export function setRowFood<U, F>(rows: readonly ReviewRow<U, F>[], key: string, food: Choice<F>): ReviewRow<U, F>[] {
  return rows.map((row) => (row.key === key ? { ...row, food } : row));
}

/** The row with its unit choice replaced. Pure. */
export function setRowUnit<U, F>(rows: readonly ReviewRow<U, F>[], key: string, unit: Choice<U>): ReviewRow<U, F>[] {
  return rows.map((row) => (row.key === key ? { ...row, unit } : row));
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
    return { textOnly: true, originalText: row.originalText, quantity: null, fixed: false, note: "", unit: null, food: null };
  }
  return {
    textOnly: false,
    originalText: row.originalText,
    quantity: row.quantity,
    fixed: row.fixed,
    note: row.note,
    unit: commitRef(row.unit),
    food,
  };
}

/** How a row reads: `matched` once its food resolves, `review` while a proposal is still undecided, `text` when it will commit as a raw line. Pure. */
export function rowStatus<U, F>(row: ReviewRow<U, F>): RowStatus {
  if (row.food.kind !== "none") return row.unit.kind === "none" && row.unitText !== "" ? "review" : "matched";
  return row.foodText === "" ? "text" : "review";
}

/** The rows still waiting on a decision: the count the sheet shows before Add. Pure. */
export function reviewCount<U, F>(rows: readonly ReviewRow<U, F>[]): number {
  return rows.filter((row) => rowStatus(row) === "review").length;
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
