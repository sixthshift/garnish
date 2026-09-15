import type { IngredientReview } from "../../../domain/draft";
import type { Choice } from "../../../domain/ingredient";

/** The amount a row shows as a chip: "" for no amount, a leading `=` for a fixed one. Pure. */
export function amountChip(row: IngredientReview): string {
  if (row.quantity === null) return "";
  return `${row.fixed ? "=" : ""}${row.quantity}`;
}

/** A chip's text: the chosen row's name, the name a create would use, or the fallback for a declined slot. Pure. */
export function chipText(choice: Choice<{ name: string }>, declined: string): string {
  if (choice.kind === "existing") return choice.row.name;
  if (choice.kind === "create") return `create “${choice.name}”`;
  return declined;
}

/** Chip colour by decision: a match is quiet, a pending create is brand, a declined slot is muted. Pure. */
export function chipIntent(kind: Choice<unknown>["kind"]): "neutral" | "brand" | "muted" {
  if (kind === "existing") return "neutral";
  return kind === "create" ? "brand" : "muted";
}
