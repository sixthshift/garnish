import { text } from "../../scraped/text";
import { isNode, type Node, number, pick } from "../json";
import type { MealieIngredient, MealiePart } from "./types";

/** A row's line: what Mealie displayed, else what its fields spell out. Pure. */
export function ingredientLine(row: MealieIngredient): string {
  return [row.quantity === null ? "" : String(row.quantity), row.unit, row.food, row.note === "" ? "" : `, ${row.note}`]
    .filter((piece) => piece !== "")
    .join(" ")
    .replace(" ,", ",")
    .trim();
}

/** One of Mealie's `recipeIngredient` rows. Pure. */
export function mealieIngredient(node: Node): MealieIngredient {
  const food = isNode(node.food) ? text(pick(node.food, "name")) : text(pick(node, "food"));
  const unit = isNode(node.unit) ? text(pick(node.unit, "name")) : text(pick(node, "unit"));
  const row: MealieIngredient = {
    originalText: "",
    quantity: number(pick(node, "quantity")),
    unit: unit.trim(),
    food: food.trim(),
    note: text(pick(node, "note")).trim(),
  };
  const original = text(pick(node, "originalText", "original_text")).trim() || text(pick(node, "display")).trim();
  // A row Mealie never structured (its `isFood: false`) keeps its whole line in
  // `note`. The line is all there is, so it becomes the text and is not also
  // left in the note to be shown twice.
  if (row.food === "") return { ...row, originalText: original === "" ? row.note : original, note: "" };
  return { ...row, originalText: original === "" ? ingredientLine(row) : original };
}

/**
 * Mealie's two flat lists as parts. A row with a `title` opens a part of that
 * name; rows before the first title are the unnamed main body. An instruction
 * section with the same name as an ingredient section is the same part, so a
 * recipe with "Pastry" in both lists gets one Pastry part with its rows and its
 * steps. Pure.
 */
export function partsFromMealie(ingredients: readonly Node[], instructions: readonly Node[]): MealiePart[] {
  const parts: MealiePart[] = [];
  const byName = new Map<string, MealiePart>();
  const partFor = (name: string): MealiePart => {
    const key = name.toLowerCase();
    const found = byName.get(key);
    if (found) return found;
    const part: MealiePart = { name, ingredients: [], steps: [], rows: [] };
    byName.set(key, part);
    parts.push(part);
    return part;
  };

  let current = "";
  for (const row of ingredients) {
    const title = text(pick(row, "title")).trim();
    if (title !== "") current = title;
    const parsed = mealieIngredient(row);
    const part = partFor(current);
    part.rows.push(parsed);
    part.ingredients.push(parsed.originalText);
  }

  // Mealie sections its two lists separately, so untitled instructions belong
  // to the unnamed body — unless the ingredients made exactly one section and
  // the instructions name none, where the one section is plainly the recipe.
  const titled = instructions.some((step) => text(pick(step, "title")).trim() !== "");
  current = !titled && parts.length === 1 ? parts[0]!.name : "";
  for (const step of instructions) {
    const title = text(pick(step, "title")).trim();
    if (title !== "") current = title;
    const body = text(pick(step, "text")).trim();
    if (body === "") continue;
    partFor(current).steps.push(body);
  }

  return parts.length > 0 ? parts : [{ name: "", ingredients: [], steps: [], rows: [] }];
}
