// How garnish read an ingredient line, as a phone's editor shows it while it is
// typed (decisions.md row 208): the amount and unit, the food, the note, apart.
// A line typed into the box is read by the same parser bulk add reviews it
// with; a row already in the draft is read from its fields.

import { formatAmount, formatRange, inflectIngredient, parseIngredient } from "../ingredient";
import type { FoodRow, Unit } from "../reference";
import { displayIngredient } from "./ingredients";
import type { IngredientReview } from "./review";
import type { DraftIngredient } from "./types";

/**
 * One line as read. `read`: the amount and unit ("" for none), the food, the
 * note, whether the amount is fixed, and whether the food is one the library
 * already has. `text`: no food could be read, and the line stays as written.
 */
export type LineRead = { kind: "read"; amount: string; food: string; note: string; fixed: boolean; known: boolean } | { kind: "text"; text: string };

/** A draft row as read: its own fields, the way the recipe page words them. Null for a blank row. Pure. */
export function rowRead(ingredient: DraftIngredient): LineRead | null {
  const tokens = inflectIngredient(displayIngredient(ingredient));
  if (tokens.raw) return { kind: "text", text: tokens.text };
  if (tokens.food === "" && tokens.quantity === "" && tokens.note === "") return null;
  return {
    kind: "read",
    amount: [tokens.quantity, tokens.unit].filter((part) => part !== "").join(" "),
    food: tokens.food,
    note: tokens.note,
    fixed: ingredient.fixed === true,
    known: Boolean(ingredient.food),
  };
}

/**
 * A typed line as the parser reads it against the library: a matched unit
 * and food by their names, an unmatched one by the words it would be created
 * from. A line with no words left for a food is text. Pure.
 */
export function lineRead(line: string, vocabulary: { units: readonly Unit[]; foods: readonly FoodRow[] }): LineRead {
  const parsed = parseIngredient(line, vocabulary);
  return parsedRead({
    originalText: parsed.originalText,
    quantity: parsed.quantity,
    quantityMax: parsed.quantityMax,
    fixed: parsed.fixed,
    note: parsed.note,
    unit: parsed.unit,
    unitText: parsed.unitText,
    food: parsed.food,
    foodText: parsed.foodText,
  });
}

/**
 * A line Check still asks about, as the parse proposed it: the unit and food
 * it found, or the words it would create them from. Pure.
 */
export function reviewRead(row: IngredientReview): LineRead {
  return parsedRead({
    originalText: row.originalText,
    quantity: row.quantity,
    quantityMax: row.quantityMax,
    fixed: row.fixed,
    note: row.note,
    unit: row.unit.kind === "existing" ? row.unit.row : null,
    unitText: row.unit.kind === "create" ? row.unit.name : row.unitText,
    food: row.food.kind === "existing" ? row.food.row : null,
    foodText: row.food.kind === "create" ? row.food.name : row.foodText,
  });
}

type Parsed = {
  originalText: string;
  quantity: number | null;
  quantityMax: number | null;
  fixed: boolean;
  note: string;
  unit: Unit | null;
  unitText: string;
  food: FoodRow | null;
  foodText: string;
};

function parsedRead(parsed: Parsed): LineRead {
  const food = parsed.food?.name ?? parsed.foodText.trim();
  if (food === "") return { kind: "text", text: parsed.originalText };
  const amount =
    parsed.unit !== null
      ? formatAmount(parsed.quantity, parsed.unit, parsed.quantityMax)
      : [formatRange(parsed.quantity, parsed.quantityMax), parsed.unitText.trim()].filter((part) => part !== "").join(" ");
  return {
    kind: "read",
    amount,
    food,
    note: parsed.note,
    fixed: parsed.fixed,
    known: parsed.food !== null,
  };
}
