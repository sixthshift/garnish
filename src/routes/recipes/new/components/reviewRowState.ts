// The import review's rows: what each ingredient row says at a glance, the counts above it, and the two decisions it can take for every row at once. Pure.

import type { IngredientReview } from "../../../../domain/draft";
import { formatAmount, rowStatus } from "../../../../domain/ingredient";
import { amountChip } from "../../components/reviewChips";

/** How a row stands: a food already here, one to create, one still undecided, or a line kept as text. */
export type RowState = "matched" | "create" | "unknown" | "text";

export function rowState(row: IngredientReview): RowState {
  if (row.food.kind === "existing") return rowStatus(row) === "review" ? "unknown" : "matched";
  if (row.food.kind === "create") return "create";
  return rowStatus(row) === "review" ? "unknown" : "text";
}

/** A row in one line: the amount and unit, the food, the note, and what will happen to it. */
export function rowSummary(row: IngredientReview): { amount: string; food: string; note: string; state: RowState; label: string } {
  const state = rowState(row);
  const food = row.food.kind === "existing" ? row.food.row.name : row.food.kind === "create" ? row.food.name : row.foodText;
  // A unit this library has reads as the recipe page reads it — "1/8 teaspoon", "3 tablespoons"; one it does not is the page's own word.
  const amount =
    row.unit.kind === "existing"
      ? `${row.fixed ? "=" : ""}${formatAmount(row.quantity, row.unit.row)}`
      : [amountChip(row), row.unit.kind === "create" ? row.unit.name : row.unitText].filter((part) => part !== "").join(" ");
  const label =
    state === "matched"
      ? "Matched"
      : state === "create"
        ? "New food"
        : state === "unknown"
          ? row.foodText !== "" && row.food.kind === "none"
            ? "Unknown food"
            : "Unknown unit"
          : "Text only";
  return state === "text" ? { amount: "", food: row.originalText, note: "", state, label } : { amount, food, note: row.note, state, label };
}

/** The counts above the list. */
export function reviewCounts(rows: readonly IngredientReview[]): Record<RowState, number> {
  const counts: Record<RowState, number> = { matched: 0, create: 0, unknown: 0, text: 0 };
  for (const row of rows) counts[rowState(row)] += 1;
  return counts;
}

/** Every unknown food and unit proposed for creation: the one press that replaces a Create button per row. */
export function createAllNew(rows: readonly IngredientReview[]): IngredientReview[] {
  return rows.map((row) => ({
    ...row,
    food: row.food.kind === "none" && row.foodText !== "" ? { kind: "create", name: row.foodText } : row.food,
    unit: row.unit.kind === "none" && row.unitText !== "" ? { kind: "create", name: row.unitText } : row.unit,
  }));
}

/** Every proposed creation taken back, so those rows land as the lines the page wrote. */
export function leaveAllAsText(rows: readonly IngredientReview[]): IngredientReview[] {
  return rows.map((row) => ({
    ...row,
    food: row.food.kind === "create" ? { kind: "none" } : row.food,
    unit: row.unit.kind === "create" ? { kind: "none" } : row.unit,
  }));
}
