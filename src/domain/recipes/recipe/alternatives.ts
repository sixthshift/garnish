// What a line can be made with instead (decisions.md row 199), worked out at
// the line's amount.

import { formatAmount, formatIngredient } from "../ingredient";
import { convert, type Food, type Unit } from "../reference";
import type { Alternative, AlternativeItem, Ingredient } from "./recipe";

/** The line fields an alternative is worked out from. A read `Ingredient` satisfies it. */
export type AlternativeRow = Pick<Ingredient, "quantity" | "unit"> & {
  /** Only its conversions are read, to put the line's amount in a basis unit. */
  food: Pick<Food, "conversions"> | null;
};

/**
 * The line's amount in the alternative's basis unit, or null when the two
 * cannot be related: no amount on the line, one side with a unit and the
 * other without, or no conversion between them for the line's food.
 */
function rowInBasis(row: AlternativeRow, basisUnit: Unit | null): number | null {
  if (row.quantity === null || row.quantity === 0) return null;
  if (basisUnit === null || row.unit === null) return basisUnit === row.unit ? row.quantity : null;
  if (basisUnit.id === row.unit.id) return row.quantity;
  return convert(row.quantity, row.unit, row.food ?? { conversions: [] }, basisUnit);
}

/**
 * An alternative at a line's amount: what goes in, and the basis to read it
 * by when the amounts could not be worked out.
 *
 * No basis is a straight swap: an item with no amount takes the line's, an
 * item with one keeps it (it scales with the servings as the line does).
 * With a basis, the items scale by the line's amount over the basis ("per 1
 * cup", line 250 ml: about one cup's worth); when the line cannot be put in
 * the basis unit, the items stay as written and `per` says what they are per.
 * Pure.
 */
export function alternativeAt(row: AlternativeRow, alternative: Alternative): { items: AlternativeItem[]; per: string | null } {
  const sameAsRow = (item: AlternativeItem): AlternativeItem => ({ ...item, quantity: row.quantity, unit: row.unit });
  if (alternative.basisQuantity === null) {
    return { items: alternative.items.map((item) => (item.quantity === null ? sameAsRow(item) : item)), per: null };
  }
  const inBasis = rowInBasis(row, alternative.basisUnit);
  if (inBasis === null) {
    return {
      items: alternative.items.map((item) => (item.quantity === null ? { ...item, quantity: alternative.basisQuantity, unit: alternative.basisUnit } : item)),
      per: formatAmount(alternative.basisQuantity, alternative.basisUnit),
    };
  }
  const factor = inBasis / alternative.basisQuantity;
  return {
    items: alternative.items.map((item) => (item.quantity === null ? sameAsRow(item) : { ...item, quantity: item.quantity * factor })),
    per: null,
  };
}

const and = new Intl.ListFormat("en-AU", { style: "long", type: "conjunction" });

/**
 * An alternative as one line at a line's amount: "500 g beef strips", "250 ml
 * milk and 1 tbsp lemon juice", "1 cup milk and 1 tbsp lemon juice per 1
 * cup". The note is the caller's to show beside it. Pure.
 */
export function alternativeText(row: AlternativeRow, alternative: Alternative): string {
  const { items, per } = alternativeAt(row, alternative);
  const text = and.format(items.map((item) => formatIngredient({ quantity: item.quantity, unit: item.unit, food: item.food, note: "", originalText: "" })));
  return per === null ? text : `${text} per ${per}`;
}
